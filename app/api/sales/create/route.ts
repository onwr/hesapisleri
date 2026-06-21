import { NextResponse } from "next/server";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import {
  recordSaleCollection,
  resolveSalePayment,
  type SalePaymentMethod,
} from "@/lib/sale-payment-utils";
import {
  applyCustomerCollection,
  applyCustomerDebtFromDocument,
} from "@/lib/customer-balance-utils";
import {
  SaleStockValidationError,
  applySaleStockDecrement,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import {
  calculateSaleTotals,
  resolveSaleDiscountInput,
  validateSaleDiscountInput,
  validateSaleLineItems,
} from "@/lib/sale-calculation-utils";
import { formatMoney } from "@/lib/format-utils";
import { generateSaleNo } from "@/lib/sale-number-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { requireApiTenantContext } from "@/lib/tenant/tenant-context";
import { assertOptionalTenantCustomer } from "@/lib/tenant/tenant-resource";
import { TenantNotFoundError } from "@/lib/tenant/tenant-errors";

const saleItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Ürün adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).max(100).default(20),
});

const createSaleSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("PAID"),
  collectedAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  note: z.string().optional(),
  discount: z.number().min(0).default(0),
  discountType: z.enum(["AMOUNT", "PERCENT"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountNote: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "En az bir ürün ekleyin."),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireApiTenantContext("sales");
    if ("error" in authResult) return authResult.error;

    const tenant = authResult.tenant;
    const body = await req.json();
    const parsed = createSaleSchema.safeParse(body);

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

    const { customerId, note, items, paymentMethod, paymentStatus, warehouseId } =
      parsed.data;

    const lineError = validateSaleLineItems(items);
    if (lineError) {
      return NextResponse.json(
        { success: false, message: lineError },
        { status: 400 }
      );
    }

    const collectedAmount =
      parsed.data.collectedAmount ?? parsed.data.paidAmount;

    const discountInput = resolveSaleDiscountInput({
      discount: parsed.data.discount,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
    });

    const totals = calculateSaleTotals(items, discountInput);
    const discountError = validateSaleDiscountInput(totals.gross, discountInput);

    if (discountError) {
      return NextResponse.json(
        { success: false, message: discountError },
        { status: 400 }
      );
    }

    const { subtotal, vatTotal, discount, total } = totals;

    let payment;

    try {
      payment = resolveSalePayment({
        paymentStatus,
        total,
        collectedAmount,
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

    let stockWarnings: Awaited<ReturnType<typeof validateSaleItemsStock>> = [];

    await assertOptionalTenantCustomer(db, tenant.companyId, customerId);

    const sale = await db.$transaction(async (tx) => {
      const resolvedWarehouseId = await resolveWarehouseId(
        tenant.companyId,
        warehouseId,
        tx
      );

      stockWarnings = await validateSaleItemsStock(
        tx,
        tenant.companyId,
        items,
        resolvedWarehouseId
      );

      const createdSale = await tx.sale.create({
        data: {
          companyId: tenant.companyId,
          customerId: customerId || null,
          userId: tenant.userId,
          warehouseId: resolvedWarehouseId,
          saleNo: generateSaleNo(),
          subtotal,
          vatTotal,
          discount,
          total,
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
          status: "COMPLETED",
          sourceChannel: "MANUAL",
          orderStatus: "APPROVED",
          note: [parsed.data.discountNote?.trim(), note?.trim()]
            .filter(Boolean)
            .join(" | ") || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId || null,
              warehouseId: resolvedWarehouseId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      await applySaleStockDecrement(
        tx,
        tenant.companyId,
        createdSale.saleNo,
        items,
        resolvedWarehouseId
      );

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: tenant.companyId,
          saleNo: createdSale.saleNo,
          amount: payment.paidAmount,
          paymentMethod: paymentMethod as SalePaymentMethod,
          note:
            payment.paymentStatus === "PARTIAL"
              ? `${createdSale.saleNo} numaralı satış için kısmi tahsilat.`
              : `${createdSale.saleNo} numaralı satış tahsilatı.`,
        });
      }

      await applyCustomerDebtFromDocument(
        tx,
        tenant.companyId,
        customerId || null,
        total,
        payment.paidAmount
      );

      await tx.activityLog.create({
        data: {
          companyId: tenant.companyId,
          userId: tenant.userId,
          action: "CREATE",
          module: "sales",
          message: `${createdSale.saleNo} numaralı satış oluşturuldu: ${formatMoney(Number(createdSale.total))}.`,
        },
      });

      await createNotification(
        {
          companyId: tenant.companyId,
          userId: tenant.userId,
          type: "SUCCESS",
          category: "SALES",
          module: "sales",
          entityType: "SALE",
          entityId: createdSale.id,
          actionUrl: `/sales/${createdSale.id}`,
          title: "Yeni satış oluşturuldu",
          message: `${createdSale.saleNo} numaralı satış başarıyla oluşturuldu.`,
        },
        tx
      );

      return createdSale;
    });

    invalidateDashboardCache(tenant.companyId, "sale-create");

    return NextResponse.json({
      success: true,
      message: "Satış başarıyla oluşturuldu.",
      ...(stockWarnings.length > 0
        ? {
            warning: stockWarnings[0]?.message,
            negativeStockItems: stockWarnings,
          }
        : {}),
      data: sale,
    });
  } catch (error) {
    console.error("CREATE_SALE_ERROR", error);

    if (error instanceof SaleStockValidationError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof TenantNotFoundError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Satış oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
