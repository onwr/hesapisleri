import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import {
  applyCustomerDebtFromDocument,
  reverseCustomerDebtFromDocument,
} from "@/lib/customer-balance-utils";
import {
  calculateSaleTotals,
  resolveSaleDiscountInput,
  validateSaleDiscountInput,
  validateSaleLineItems,
} from "@/lib/sale-calculation-utils";
import { reverseSaleIncomeTransactions } from "@/lib/sale-finance-reversal-utils";
import { validateSaleEditEligibility } from "@/lib/sale-mutation-policy";
import {
  derivePaymentStatus,
  recordSaleCollection,
  resolveSalePayment,
  roundMoney,
} from "@/lib/sale-payment-utils";
import {
  SaleStockValidationError,
  validateSaleItemsStock,
} from "@/lib/sale-stock-utils";
import {
  applySaleStockCorrectionDeltas,
  buildSaleStockCorrectionDeltas,
  validateSaleStockCorrectionDeltas,
} from "@/lib/sale-update-stock-utils";
import { resolveWarehouseId } from "@/lib/warehouse-service";

export const updateSaleItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1, "Ürün adı zorunludur."),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).max(100).default(20),
});

export const updateSaleSchema = z.object({
  customerId: z.string().optional().nullable(),
  saleDate: z.string().optional(),
  note: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]),
  collectedAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  accountId: z.string().trim().min(1).optional(),
  discount: z.number().min(0).optional(),
  discountType: z.enum(["AMOUNT", "PERCENT"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountNote: z.string().optional().nullable(),
  items: z.array(updateSaleItemSchema).min(1, "En az bir ürün ekleyin."),
});

export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

function parseSaleDate(value?: string | null) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function updateSaleById(input: {
  saleId: string;
  companyId: string;
  userId: string;
  data: UpdateSaleInput;
}) {
  const sale = await db.sale.findFirst({
    where: {
      id: input.saleId,
      companyId: input.companyId,
    },
    include: {
      items: true,
      invoice: {
        include: {
          documentSubmission: true,
        },
      },
    },
  });

  if (!sale) {
    return { ok: false as const, status: 404, message: "Satış bulunamadı." };
  }

  const eligibility = validateSaleEditEligibility(sale);
  if (!eligibility.ok) {
    return {
      ok: false as const,
      status: 400,
      message: eligibility.message,
    };
  }

  const lineError = validateSaleLineItems(input.data.items);
  if (lineError) {
    return { ok: false as const, status: 400, message: lineError };
  }

  const discountInput = resolveSaleDiscountInput({
    discount: input.data.discount,
    discountType: input.data.discountType,
    discountValue: input.data.discountValue,
  });

  const totals = calculateSaleTotals(input.data.items, discountInput);
  const discountError = validateSaleDiscountInput(totals.gross, discountInput);
  if (discountError) {
    return { ok: false as const, status: 400, message: discountError };
  }

  const collectedAmount =
    input.data.collectedAmount ?? input.data.paidAmount ?? undefined;

  let payment;
  try {
    payment = resolveSalePayment({
      paymentStatus: input.data.paymentStatus,
      total: totals.total,
      collectedAmount,
    });
  } catch (error) {
    return {
      ok: false as const,
      status: 400,
      message:
        error instanceof Error ? error.message : "Ödeme bilgileri geçersiz.",
    };
  }

  if (payment.paidAmount > 0 && !input.data.accountId) {
    return {
      ok: false as const,
      status: 400,
      message: "Tahsilat hesabı seçilmelidir.",
    };
  }

  const parsedSaleDate = input.data.saleDate
    ? parseSaleDate(input.data.saleDate)
    : sale.saleDate;

  if (input.data.saleDate && !parsedSaleDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir satış tarihi girin.",
    };
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      const resolvedWarehouseId = await resolveWarehouseId(
        input.companyId,
        input.data.warehouseId ?? sale.warehouseId,
        tx
      );

      const stockWarnings = await validateSaleItemsStock(
        tx,
        input.companyId,
        input.data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
        })),
        resolvedWarehouseId
      );

      const hardStockIssue = stockWarnings.find((warning) => warning.productId);
      if (hardStockIssue) {
        throw new SaleStockValidationError(hardStockIssue.message);
      }

      const correctionDeltas = buildSaleStockCorrectionDeltas(
        sale.items.map((item) => ({
          productId: item.productId,
          warehouseId: item.warehouseId ?? sale.warehouseId,
          quantity: item.quantity,
        })),
        input.data.items.map((item) => ({
          productId: item.productId ?? null,
          warehouseId: resolvedWarehouseId,
          quantity: item.quantity,
        })),
        resolvedWarehouseId
      );

      const correctionWarnings = await validateSaleStockCorrectionDeltas(
        tx,
        input.companyId,
        correctionDeltas
      );

      if (correctionWarnings.length > 0) {
        throw new SaleStockValidationError(correctionWarnings[0]!.message);
      }

      await reverseSaleIncomeTransactions(tx, {
        companyId: input.companyId,
        saleNo: sale.saleNo,
        reversalTitle: `Satış Düzeltme Geri Alım - ${sale.saleNo}`,
        reversalNote: `${sale.saleNo} numaralı satış düzenlemesi için önceki tahsilat geri alındı.`,
        mirrorKind: "CORRECTION",
      });

      await applySaleStockCorrectionDeltas(
        tx,
        input.companyId,
        sale.saleNo,
        correctionDeltas
      );

      await reverseCustomerDebtFromDocument(
        tx,
        input.companyId,
        sale.customerId,
        Number(sale.total),
        Number(sale.paidAmount)
      );

      await tx.saleItem.deleteMany({
        where: { saleId: sale.id },
      });

      const noteParts = [
        input.data.discountNote?.trim(),
        input.data.note?.trim(),
      ].filter(Boolean);

      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          customerId: input.data.customerId || null,
          warehouseId: resolvedWarehouseId,
          saleDate: parsedSaleDate ?? sale.saleDate,
          note: noteParts.length > 0 ? noteParts.join(" | ") : null,
          subtotal: totals.subtotal,
          vatTotal: totals.vatTotal,
          discount: totals.discount,
          total: totals.total,
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
          items: {
            create: input.data.items.map((item) => ({
              productId: item.productId || null,
              warehouseId: resolvedWarehouseId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              total: roundMoney(item.quantity * item.unitPrice),
            })),
          },
        },
        include: {
          items: true,
        },
      });

      if (payment.paidAmount > 0) {
        await recordSaleCollection(tx, {
          companyId: input.companyId,
          saleNo: sale.saleNo,
          amount: payment.paidAmount,
          accountId: input.data.accountId!,
          note: `${sale.saleNo} numaralı satış düzenlemesi sonrası tahsilat.`,
        });
      }

      await applyCustomerDebtFromDocument(
        tx,
        input.companyId,
        updatedSale.customerId,
        totals.total,
        payment.paidAmount
      );

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "UPDATE",
          module: "sales",
          message: `${sale.saleNo} numaralı satış düzenlendi (stok ve finans düzeltmeleri uygulandı).`,
        },
      });

      await createNotification(
        {
          companyId: input.companyId,
          userId: input.userId,
          type: "INFO",
          category: "SALES",
          module: "sales",
          entityType: "SALE",
          entityId: sale.id,
          actionUrl: `/sales/${sale.id}`,
          title: "Satış güncellendi",
          message: `${sale.saleNo} numaralı satış başarıyla düzenlendi.`,
        },
        tx
      );

      return updatedSale;
    });

    invalidateDashboardCache(input.companyId, "sale-update");

    return {
      ok: true as const,
      message: "Satış başarıyla güncellendi.",
      data: {
        id: updated.id,
        saleNo: updated.saleNo,
        total: Number(updated.total),
        paidAmount: Number(updated.paidAmount),
        previousTotal: Number(sale.total),
        previousPaidAmount: Number(sale.paidAmount),
      },
    };
  } catch (error) {
    if (error instanceof SaleStockValidationError) {
      return { ok: false as const, status: 400, message: error.message };
    }

    throw error;
  }
}
