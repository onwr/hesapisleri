import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
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
import { generateSaleNo } from "@/lib/sale-number-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const saleItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Ürün adı zorunludur."),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().default(20),
});

const createSaleSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("PAID"),
  collectedAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  paymentMethod: z.enum(["CASH", "BANK"]).default("CASH"),
  note: z.string().optional(),
  items: z.array(saleItemSchema).min(1, "En az bir ürün ekleyin."),
});

export async function POST(req: Request) {
  try {
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
    const collectedAmount =
      parsed.data.collectedAmount ?? parsed.data.paidAmount;

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const vatTotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.vatRate) / 100;
    }, 0);

    const total = subtotal + vatTotal;

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

    const sale = await db.$transaction(async (tx) => {
      const resolvedWarehouseId = await resolveWarehouseId(
        payload.companyId!,
        warehouseId,
        tx
      );

      await validateSaleItemsStock(
        tx,
        payload.companyId!,
        items,
        resolvedWarehouseId
      );

      const createdSale = await tx.sale.create({
        data: {
          companyId: payload.companyId!,
          customerId: customerId || null,
          userId: payload.userId,
          warehouseId: resolvedWarehouseId,
          saleNo: generateSaleNo(),
          subtotal,
          vatTotal,
          discount: 0,
          total,
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
          status: "COMPLETED",
          sourceChannel: "MANUAL",
          orderStatus: "APPROVED",
          note: note || null,
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
        payload.companyId!,
        createdSale.saleNo,
        items,
        resolvedWarehouseId
      );

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: payload.companyId!,
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
        customerId || null,
        total,
        payment.paidAmount
      );

      await tx.activityLog.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          action: "CREATE",
          module: "sales",
          message: `${createdSale.saleNo} numaralı satış oluşturuldu.`,
        },
      });

      await tx.notification.create({
        data: {
          companyId: payload.companyId!,
          userId: payload.userId,
          type: "SUCCESS",
          title: "Yeni satış oluşturuldu",
          message: `${createdSale.saleNo} numaralı satış başarıyla oluşturuldu.`,
        },
      });

      return createdSale;
    });

    return NextResponse.json({
      success: true,
      message: "Satış başarıyla oluşturuldu.",
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
