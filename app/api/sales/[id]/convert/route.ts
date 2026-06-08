import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  applyCustomerDebtFromDocument,
} from "@/lib/customer-balance-utils";
import { generateSaleNo } from "@/lib/sale-number-utils";
import {
  recordSaleCollection,
  resolveSalePayment,
  type SalePaymentMethod,
} from "@/lib/sale-payment-utils";
import {
  applySaleStockDecrement,
  SaleStockValidationError,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import { isQuoteSaleStatus } from "@/lib/sale-query-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const convertSchema = z.object({
  warehouseId: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("UNPAID"),
  collectedAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = convertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz dönüşüm bilgileri." },
        { status: 400 }
      );
    }

    const { paymentStatus, paymentMethod } = parsed.data;

    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: payload.companyId,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { success: false, message: "Teklif bulunamadı." },
        { status: 404 }
      );
    }

    if (!isQuoteSaleStatus(sale.status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Sadece taslak teklifler satışa dönüştürülebilir.",
        },
        { status: 400 }
      );
    }

    const total = Number(sale.total);

    let payment;

    try {
      payment = resolveSalePayment({
        paymentStatus,
        total,
        collectedAmount: parsed.data.collectedAmount,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Ödeme bilgileri geçersiz.",
        },
        { status: 400 }
      );
    }

    const stockItems = sale.items.map((item) => ({
      productId: item.productId ?? undefined,
      quantity: item.quantity,
      name: item.name,
    }));

    const { warehouseId } = parsed.data;

    const updatedSale = await db.$transaction(async (tx) => {
      const resolvedWarehouseId = await resolveWarehouseId(
        payload.companyId!,
        warehouseId,
        tx
      );

      await validateSaleItemsStock(
        tx,
        payload.companyId!,
        stockItems,
        resolvedWarehouseId
      );

      const newSaleNo = generateSaleNo();

      const converted = await tx.sale.update({
        where: { id: sale.id },
        data: {
          saleNo: newSaleNo,
          status: "COMPLETED",
          sourceChannel: "MANUAL",
          orderStatus: "APPROVED",
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
          warehouseId: resolvedWarehouseId,
        },
        include: {
          items: true,
          customer: true,
        },
      });

      await tx.saleItem.updateMany({
        where: { saleId: sale.id },
        data: { warehouseId: resolvedWarehouseId },
      });

      await applySaleStockDecrement(
        tx,
        payload.companyId!,
        newSaleNo,
        sale.items,
        resolvedWarehouseId
      );

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: payload.companyId!,
          saleNo: newSaleNo,
          amount: payment.paidAmount,
          paymentMethod: paymentMethod as SalePaymentMethod,
          note:
            payment.paymentStatus === "PARTIAL"
              ? `${newSaleNo} numaralı satış için kısmi tahsilat.`
              : `${newSaleNo} numaralı satış tahsilatı.`,
        });
      }

      await applyCustomerDebtFromDocument(
        tx,
        sale.customerId,
        total,
        payment.paidAmount
      );

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı teklif ${newSaleNo} numaralı satışa dönüştürüldü.`,
        },
      });

      await tx.notification.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          type: "SUCCESS",
          title: "Teklif satışa dönüştürüldü",
          message: `${sale.saleNo} teklifi ${newSaleNo} numaralı satış olarak tamamlandı.`,
        },
      });

      return converted;
    });

    return NextResponse.json({
      success: true,
      message: "Teklif başarıyla satışa dönüştürüldü.",
      data: { id: updatedSale.id, saleNo: updatedSale.saleNo },
    });
  } catch (error) {
    console.error("CONVERT_QUOTE_ERROR", error);

    if (error instanceof SaleStockValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Teklif dönüştürülürken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
