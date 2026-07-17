import "server-only";

import type { Prisma } from "@prisma/client";
import { createNotification } from "@/lib/notification-service";
import { adjustCustomerBalance } from "@/lib/customer-balance-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { isServiceProductType } from "@/lib/product-type-utils";
import { validatePosPaymentAccount } from "@/lib/pos-payment-account-utils";
import { db } from "@/lib/prisma";
import { runTransactionWithRetry } from "@/lib/prisma-transaction-utils";
import { roundMoney } from "@/lib/sale-payment-utils";
import {
  allocateSaleReturnRefundAmounts,
  buildReturnedQuantityMap,
  generateSaleReturnNo,
  resolveSaleReturnStatus,
  validateSaleReturnLines,
  type SaleReturnLineInput,
  type SaleReturnRefundMethod,
} from "@/lib/sale-return-utils";
import { writeLifecycleActivityLog } from "@/lib/transaction-lifecycle-enforcement";
import {
  ensureProductWarehouseStock,
  getOrCreateDefaultWarehouse,
  syncProductTotalStock,
} from "@/lib/warehouse-service";

type TransactionClient = Prisma.TransactionClient;

export class SaleReturnError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SaleReturnError";
    this.status = status;
  }
}

export type CreateSaleReturnInput = {
  companyId: string;
  userId: string;
  saleId: string;
  reason: string;
  note?: string | null;
  refundMethod: SaleReturnRefundMethod;
  accountId?: string | null;
  lines: SaleReturnLineInput[];
};

async function loadSaleForReturn(
  client: Pick<typeof db, "sale"> | TransactionClient,
  companyId: string,
  saleId: string
) {
  return client.sale.findFirst({
    where: { id: saleId, companyId },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              productType: true,
            },
          },
        },
      },
      returns: {
        where: { status: "COMPLETED" },
        include: {
          items: {
            select: {
              saleItemId: true,
              quantity: true,
            },
          },
        },
      },
    },
  });
}

async function recordSaleReturnRefundTransaction(
  tx: TransactionClient,
  input: {
    companyId: string;
    saleNo: string;
    returnNo: string;
    amount: number;
    accountId: string;
    refundMethod: "CASH" | "CARD";
  }
) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return;

  const account = await tx.account.findFirst({
    where: {
      id: input.accountId,
      companyId: input.companyId,
    },
  });

  const validation = validatePosPaymentAccount(
    account,
    input.companyId,
    input.refundMethod
  );
  if (!validation.ok) {
    throw new SaleReturnError(validation.message, 400);
  }

  await tx.account.update({
    where: { id: validation.account.id },
    data: {
      balance: {
        decrement: amount,
      },
    },
  });

  const methodLabel =
    input.refundMethod === "CASH" ? "Nakit iade" : "Kart iade";

  await tx.accountTransaction.create({
    data: {
      accountId: validation.account.id,
      type: "EXPENSE",
      title: `Satış iadesi — ${input.saleNo}`,
      amount,
      date: new Date(),
      note: `${methodLabel} · ${validation.account.name} · ${input.returnNo} · ${input.saleNo}`,
    },
  });
}

export async function createSaleReturn(input: CreateSaleReturnInput) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new SaleReturnError("İade nedeni zorunludur.");
  }

  if (
    input.refundMethod !== "CASH" &&
    input.refundMethod !== "CARD" &&
    input.refundMethod !== "CREDIT"
  ) {
    throw new SaleReturnError("Geçersiz iade yöntemi.");
  }

  if (
    (input.refundMethod === "CASH" || input.refundMethod === "CARD") &&
    !input.accountId?.trim()
  ) {
    throw new SaleReturnError(
      input.refundMethod === "CASH"
        ? "Nakit iade için kasa hesabı seçilmelidir."
        : "Kart iade için hesap seçilmelidir."
    );
  }

  const result = await runTransactionWithRetry(async (tx) => {
    const sale = await loadSaleForReturn(tx, input.companyId, input.saleId);
    if (!sale) {
      throw new SaleReturnError("Satış bulunamadı.", 404);
    }

    const alreadyReturnedByItemId = buildReturnedQuantityMap(
      sale.returns.flatMap((ret) => ret.items)
    );

    const validated = validateSaleReturnLines({
      saleStatus: sale.status,
      items: sale.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        name: item.name,
        productId: item.productId,
        warehouseId: item.warehouseId,
        productType: item.product?.productType ?? null,
      })),
      alreadyReturnedByItemId,
      lines: input.lines,
    });

    if (!validated.ok) {
      throw new SaleReturnError(validated.message);
    }

    const refundSplit = allocateSaleReturnRefundAmounts({
      refundMethod: input.refundMethod,
      totalReturnAmount: validated.totalReturnAmount,
    });

    const returnNo = generateSaleReturnNo();
    const saleReturn = await tx.saleReturn.create({
      data: {
        companyId: input.companyId,
        saleId: sale.id,
        customerId: sale.customerId,
        returnNo,
        status: "COMPLETED",
        reason,
        note: input.note?.trim() || null,
        refundMethod: input.refundMethod,
        accountId:
          input.refundMethod === "CREDIT" ? null : input.accountId?.trim() || null,
        totalReturnAmount: validated.totalReturnAmount,
        totalCashRefund: refundSplit.totalCashRefund,
        totalCardRefund: refundSplit.totalCardRefund,
        totalCreditAdjustment: refundSplit.totalCreditAdjustment,
        createdByUserId: input.userId,
        items: {
          create: validated.lines.map((line) => ({
            companyId: input.companyId,
            saleItemId: line.saleItem.id,
            productId: line.saleItem.productId,
            name: line.saleItem.name,
            quantity: line.quantity,
            unitPrice: line.saleItem.unitPrice,
            totalAmount: line.totalAmount,
            restock: line.restock,
            note: line.note,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    const defaultWarehouse = await getOrCreateDefaultWarehouse(
      input.companyId,
      tx
    );

    for (const line of validated.lines) {
      if (!line.restock || !line.saleItem.productId) continue;
      if (isServiceProductType(line.saleItem.productType)) continue;

      const warehouseId =
        line.saleItem.warehouseId?.trim() || defaultWarehouse.id;

      const warehouseStock = await ensureProductWarehouseStock(
        input.companyId,
        line.saleItem.productId,
        warehouseId,
        tx
      );

      await tx.warehouseStock.update({
        where: { id: warehouseStock.id },
        data: {
          quantity: warehouseStock.quantity + line.quantity,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId: input.companyId,
          productId: line.saleItem.productId,
          warehouseId,
          type: "RETURN",
          quantity: line.quantity,
          note: `Satış iadesi — ${sale.saleNo} · ${returnNo}`,
        },
      });

      await syncProductTotalStock(input.companyId, line.saleItem.productId, tx);
    }

    if (refundSplit.totalCashRefund > 0) {
      await recordSaleReturnRefundTransaction(tx, {
        companyId: input.companyId,
        saleNo: sale.saleNo,
        returnNo,
        amount: refundSplit.totalCashRefund,
        accountId: input.accountId!,
        refundMethod: "CASH",
      });
    }

    if (refundSplit.totalCardRefund > 0) {
      await recordSaleReturnRefundTransaction(tx, {
        companyId: input.companyId,
        saleNo: sale.saleNo,
        returnNo,
        amount: refundSplit.totalCardRefund,
        accountId: input.accountId!,
        refundMethod: "CARD",
      });
    }

    if (refundSplit.totalCreditAdjustment > 0) {
      if (!sale.customerId) {
        throw new SaleReturnError(
          "Cari düzeltme için satışta müşteri olmalıdır."
        );
      }
      await adjustCustomerBalance(
        tx,
        input.companyId,
        sale.customerId,
        -refundSplit.totalCreditAdjustment
      );
    }

    const nextStatus = resolveSaleReturnStatus({
      items: sale.items.map((item) => ({
        quantity: item.quantity,
        alreadyReturned: alreadyReturnedByItemId.get(item.id) ?? 0,
        returning:
          validated.lines.find((line) => line.saleItem.id === item.id)
            ?.quantity ?? 0,
      })),
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: nextStatus,
        revisionNumber: { increment: 1 },
      },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "sales",
      entityType: "SALE",
      entityId: sale.id,
      action: "UPDATE",
      message: `${sale.saleNo} numaralı satış için iade kaydı oluşturuldu (${returnNo}).`,
      reason,
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
        title: "Satış iadesi alındı",
        message: `${sale.saleNo} · ${returnNo} · ${roundMoney(validated.totalReturnAmount).toFixed(2)} TL`,
      },
      tx
    );

    return {
      saleReturn,
      saleNo: sale.saleNo,
      nextStatus,
    };
  });

  invalidateDashboardCache(input.companyId, "sale-return");

  return result;
}

export async function getSaleReturnableSummary(input: {
  companyId: string;
  saleId: string;
}) {
  const sale = await loadSaleForReturn(db, input.companyId, input.saleId);
  if (!sale) return null;

  const alreadyReturnedByItemId = buildReturnedQuantityMap(
    sale.returns.flatMap((ret) => ret.items)
  );

  return {
    sale,
    alreadyReturnedByItemId,
    items: sale.items.map((item) => {
      const returned = alreadyReturnedByItemId.get(item.id) ?? 0;
      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        productId: item.productId,
        productType: item.product?.productType ?? null,
        returnedQuantity: returned,
        returnableQuantity: Math.max(0, item.quantity - returned),
        isService: isServiceProductType(item.product?.productType),
      };
    }),
    returns: sale.returns,
  };
}
