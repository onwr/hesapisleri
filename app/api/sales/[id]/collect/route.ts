import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  derivePaymentStatus,
  getSaleRemainingAmount,
  recordSaleCollection,
  roundMoney,
  type SalePaymentMethod,
} from "@/lib/sale-payment-utils";
import { applyCustomerCollection } from "@/lib/customer-balance-utils";

type Props = {
  params: Promise<{ id: string }>;
};

const collectSchema = z.object({
  amount: z.number().min(0.01).optional(),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("cash-bank");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = collectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Satış bulunamadı." },
        { status: 404 }
      );
    }

    if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
      return NextResponse.json(
        { success: false, message: "İptal edilmiş satıştan tahsilat alınamaz." },
        { status: 400 }
      );
    }

    const total = Number(sale.total);
    const currentPaid = Number(sale.paidAmount);
    const remaining = getSaleRemainingAmount(total, currentPaid);

    const requestedAmount = parsed.data.amount;

    if (remaining <= 0 && requestedAmount == null) {
      return NextResponse.json(
        { success: false, message: "Bu satışın tahsilatı tamamlanmış." },
        { status: 400 }
      );
    }

    const collectAmount = roundMoney(requestedAmount ?? remaining);

    if (collectAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir tahsilat tutarı girin." },
        { status: 400 }
      );
    }

    const paymentMethod = parsed.data.paymentMethod as SalePaymentMethod;
    const nextPaidAmount = roundMoney(currentPaid + collectAmount);
    const cappedPaidAmount = roundMoney(Math.min(total, nextPaidAmount));
    const nextPaymentStatus = derivePaymentStatus(total, cappedPaidAmount);

    const updatedSale = await db.$transaction(async (tx) => {
      await recordSaleCollection(tx, {
        companyId,
        saleNo: sale.saleNo,
        amount: collectAmount,
        paymentMethod,
        note:
          nextPaymentStatus === "PAID"
            ? `${sale.saleNo} numaralı satışın kalan tahsilatı tamamlandı.`
            : `${sale.saleNo} numaralı satış için kısmi tahsilat.`,
      });

      await applyCustomerCollection(tx, sale.customerId, collectAmount);

      const updated = await tx.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: cappedPaidAmount,
          paymentStatus: nextPaymentStatus,
        },
      });

      await tx.activityLog.create({
        data: {
        companyId,
        userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı satıştan ${collectAmount.toFixed(2)} TL tahsil edildi.`,
        },
      });

      await tx.notification.create({
        data: {
        companyId,
        userId,
          type: nextPaymentStatus === "PAID" ? "SUCCESS" : "INFO",
          title:
            nextPaymentStatus === "PAID"
              ? "Satış tahsilatı tamamlandı"
              : "Kısmi tahsilat alındı",
          message: `${sale.saleNo} için ${collectAmount.toFixed(2)} TL tahsil edildi.`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message:
        nextPaymentStatus === "PAID"
          ? "Kalan tahsilat tamamlandı."
          : "Kısmi tahsilat kaydedildi.",
      data: {
        ...updatedSale,
        total: Number(updatedSale.total),
        paidAmount: Number(updatedSale.paidAmount),
        remainingAmount: getSaleRemainingAmount(
          Number(updatedSale.total),
          Number(updatedSale.paidAmount)
        ),
      },
    });
  } catch (error) {
    console.error("SALE_COLLECT_API_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Tahsilat kaydedilirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
