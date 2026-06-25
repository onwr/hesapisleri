import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import {
  applyCustomerDebtFromDocument,
} from "@/lib/customer-balance-utils";
import { generateSaleNo } from "@/lib/sale-number-utils";
import {
  recordSaleCollection,
  resolveSalePayment,
} from "@/lib/sale-payment-utils";
import {
  applySaleStockDecrement,
  SaleStockValidationError,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import { isQuoteSaleStatus } from "@/lib/sale-query-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

const convertSchema = z.object({
  warehouseId: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("UNPAID"),
  collectedAmount: z.number().min(0).optional(),
  accountId: z.string().trim().min(1).optional(),
});

export async function POST(req: Request, { params }: Props) {
  try {
    const { id } = await params;
    const auth = await requireApiModuleAccess("sales");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = convertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz dönüşüm bilgileri." },
        { status: 400 }
      );
    }

    const { paymentStatus, accountId } = parsed.data;

    const sale = await db.sale.findFirst({
      where: {
        id,
        companyId: companyId,
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

    if (payment.paidAmount > 0 && !accountId) {
      return NextResponse.json(
        { success: false, message: "Tahsilat hesabı seçilmelidir." },
        { status: 400 }
      );
    }

    const stockItems = sale.items.map((item) => ({
      productId: item.productId ?? undefined,
      quantity: item.quantity,
      name: item.name,
    }));

    const { warehouseId } = parsed.data;

    let stockWarnings: Awaited<ReturnType<typeof validateSaleItemsStock>> = [];

    const updatedSale = await db.$transaction(async (tx) => {
      const resolvedWarehouseId = await resolveWarehouseId(
        companyId!,
        warehouseId,
        tx
      );

      stockWarnings = await validateSaleItemsStock(
        tx,
        companyId!,
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
        companyId!,
        newSaleNo,
        sale.items,
        resolvedWarehouseId
      );

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: companyId!,
          saleNo: newSaleNo,
          amount: payment.paidAmount,
          accountId: accountId!,
          note:
            payment.paymentStatus === "PARTIAL"
              ? `${newSaleNo} numaralı satış için kısmi tahsilat.`
              : `${newSaleNo} numaralı satış tahsilatı.`,
        });
      }

      await applyCustomerDebtFromDocument(
        tx,
        companyId!,
        sale.customerId,
        total,
        payment.paidAmount
      );

      await tx.activityLog.create({
        data: {
          companyId: companyId!,
          userId: userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı teklif ${newSaleNo} numaralı satışa dönüştürüldü.`,
        },
      });

      await createNotification(
        {
          companyId: companyId!,
          userId: userId,
          type: "SUCCESS",
          category: "SALES",
          module: "sales",
          entityType: "SALE",
          entityId: converted.id,
          actionUrl: `/sales/${converted.id}`,
          title: "Teklif satışa dönüştürüldü",
          message: `${sale.saleNo} teklifi ${newSaleNo} numaralı satış olarak tamamlandı.`,
        },
        tx
      );

      return converted;
    });

    return NextResponse.json({
      success: true,
      message: "Teklif başarıyla satışa dönüştürüldü.",
      ...(stockWarnings.length > 0
        ? {
            warning: stockWarnings[0]?.message,
            negativeStockItems: stockWarnings,
          }
        : {}),
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
