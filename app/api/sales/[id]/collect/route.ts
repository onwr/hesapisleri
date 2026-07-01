import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { requireAnyApiModuleAccess } from "@/lib/module-access";
import { getUnpaidInvoiceForSale } from "@/lib/collections-service";
import {
  derivePaymentStatus,
  getSaleRemainingAmount,
  recordSaleCollection,
  roundMoney,
} from "@/lib/sale-payment-utils";
import { applyCustomerCollection } from "@/lib/customer-balance-utils";
import { buildTenantMutationSuccess } from "@/lib/tenant-cache/tenant-mutation-response";

type Props = {
  params: Promise<{ id: string }>;
};

function parsePaymentDate(value?: string | null) {
  if (!value?.trim()) {
    return new Date();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

const collectSchema = z.object({
  amount: z.number().min(0.01).optional(),
  accountId: z.string().trim().min(1, "Tahsilat hesabı seçilmelidir."),
  paymentDate: z.string().optional(),
  collectedAt: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireAnyApiModuleAccess([
      "sales",
      "cash-bank",
      "invoices",
    ]);
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
      include: {
        invoice: true,
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

    const unpaidInvoice = await getUnpaidInvoiceForSale(companyId, sale.id);

    if (unpaidInvoice) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bu satış için fatura oluşturulmuş. Tahsilatı fatura üzerinden alın.",
          code: "COLLECT_VIA_INVOICE",
          invoiceId: unpaidInvoice.id,
        },
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

    if (collectAmount > remaining) {
      return NextResponse.json(
        {
          success: false,
          message: `En fazla ${remaining.toFixed(2)} TL tahsil edebilirsiniz.`,
        },
        { status: 400 }
      );
    }

    const paymentDate = parsePaymentDate(
      parsed.data.paymentDate ?? parsed.data.collectedAt
    );

    if (!paymentDate) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir tahsilat tarihi girin." },
        { status: 400 }
      );
    }

    const nextPaidAmount = roundMoney(currentPaid + collectAmount);
    const cappedPaidAmount = roundMoney(Math.min(total, nextPaidAmount));
    const nextPaymentStatus = derivePaymentStatus(total, cappedPaidAmount);

    const updatedSale = await db.$transaction(async (tx) => {
      await recordSaleCollection(tx, {
        companyId,
        saleNo: sale.saleNo,
        amount: collectAmount,
        accountId: parsed.data.accountId,
        collectedAt: paymentDate,
        note: parsed.data.note?.trim() || undefined,
      });

      await applyCustomerCollection(
        tx,
        companyId,
        sale.customerId,
        collectAmount
      );

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

      await createNotification(
        {
          companyId,
          userId,
          type: nextPaymentStatus === "PAID" ? "SUCCESS" : "INFO",
          category: "FINANCE",
          module: "sales",
          entityType: "SALE",
          entityId: sale.id,
          actionUrl: `/sales/${sale.id}`,
          title:
            nextPaymentStatus === "PAID"
              ? "Satış tahsilatı tamamlandı"
              : "Kısmi tahsilat alındı",
          message: `${sale.saleNo} için ${collectAmount.toFixed(2)} TL tahsil edildi.`,
        },
        tx
      );

      return updated;
    });

    return NextResponse.json(
      buildTenantMutationSuccess(companyId, {
        reason: "sale-collect",
        entityIds: {
          saleId: updatedSale.id,
          customerId: updatedSale.customerId ?? undefined,
        },
        entity: {
          ...updatedSale,
          total: Number(updatedSale.total),
          paidAmount: Number(updatedSale.paidAmount),
          remainingAmount: getSaleRemainingAmount(
            Number(updatedSale.total),
            Number(updatedSale.paidAmount),
          ),
        } as Record<string, unknown>,
        message:
          nextPaymentStatus === "PAID"
            ? "Kalan tahsilat tamamlandı."
            : "Kısmi tahsilat kaydedildi.",
        status: nextPaymentStatus,
      }),
    );
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
