import { createNotification } from "@/lib/notification-service";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { reverseCustomerDebtFromDocument } from "@/lib/customer-balance-utils";
import { reverseSaleIncomeTransactions } from "@/lib/sale-finance-reversal-utils";
import { buildStockReturnEntries } from "@/lib/sale-cancel-stock-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  assertCancelReasonProvided,
  assertLifecycleAction,
  mapSaleToLifecycle,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";
import { validateSaleCancelEligibility } from "@/lib/sale-mutation-policy";
import {
  ensureProductWarehouseStock,
  getOrCreateDefaultWarehouse,
  syncProductTotalStock,
} from "@/lib/warehouse-service";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true;
            productType: true;
          };
        };
      };
    };
    invoice: {
      include: {
        documentSubmission: true;
      };
    };
    customer: true;
  };
}>;

export async function reverseSaleEffects(
  tx: TransactionClient,
  input: {
    sale: SaleWithRelations;
    companyId: string;
    userId: string;
    reason: string;
    note?: string | null;
  }
) {
  const { sale, companyId, userId, reason, note } = input;

  const existingReturns = await tx.stockMovement.count({
    where: {
      companyId,
      type: "RETURN",
      note: {
        contains: sale.saleNo,
      },
    },
  });

  if (existingReturns === 0) {
    const saleMovements = await tx.stockMovement.findMany({
      where: {
        companyId,
        type: "SALE",
        note: {
          contains: sale.saleNo,
        },
      },
      select: {
        productId: true,
        warehouseId: true,
        quantity: true,
      },
    });

    const defaultWarehouse = await getOrCreateDefaultWarehouse(companyId, tx);

    const stockItems = sale.items.filter(
      (item) =>
        item.productId &&
        (!item.product || !isServiceProductType(item.product.productType))
    );

    const returnEntries = buildStockReturnEntries(
      stockItems,
      saleMovements,
      defaultWarehouse.id
    );

    for (const entry of returnEntries) {
      const warehouseStock = await ensureProductWarehouseStock(
        companyId,
        entry.productId,
        entry.warehouseId,
        tx
      );

      await tx.warehouseStock.update({
        where: { id: warehouseStock.id },
        data: {
          quantity: warehouseStock.quantity + entry.quantity,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId: entry.productId,
          warehouseId: entry.warehouseId,
          type: "RETURN",
          quantity: entry.quantity,
          note: `${sale.saleNo} numaralı satış iptal edildi, stok iade edildi.`,
        },
      });

      await syncProductTotalStock(companyId, entry.productId, tx);
    }
  }

  await reverseSaleIncomeTransactions(tx, {
    companyId,
    saleNo: sale.saleNo,
    reversalTitle: `Satış İptali - ${sale.saleNo}`,
    reversalNote: `${sale.saleNo} numaralı satış iptal edildi, tahsilat geri alındı.`,
    mirrorKind: "REVERSAL",
  });

  if (sale.invoice && sale.invoice.status !== "CANCELLED") {
    await tx.invoice.update({
      where: { id: sale.invoice.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
      },
    });
  }

  await reverseCustomerDebtFromDocument(
    tx,
    companyId,
    sale.customerId,
    Number(sale.total),
    Number(sale.paidAmount)
  );

  await tx.sale.update({
    where: { id: sale.id },
    data: {
      status: "CANCELLED",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      cancelledAt: new Date(),
      cancelledByUserId: userId,
      cancelReason: reason,
      cancelNote: note?.trim() || null,
    },
  });

  await writeLifecycleActivityLog(tx, {
    companyId,
    userId,
    module: "sales",
    entityType: "SALE",
    entityId: sale.id,
    action: "CANCEL",
    message: `${sale.saleNo} numaralı satış iptal edildi.`,
    reason,
  });

  await createNotification(
    {
      companyId,
      userId,
      type: "WARNING",
      category: "SALES",
      module: "sales",
      entityType: "SALE",
      entityId: sale.id,
      actionUrl: `/sales/${sale.id}`,
      title: "Satış iptal edildi",
      message: `${sale.saleNo} numaralı satış iptal edildi. Stok ve finansal kayıtlar güncellendi.`,
    },
    tx
  );
}

export async function cancelSaleById(
  saleId: string,
  companyId: string,
  userId: string,
  input?: { reason?: string; note?: string | null; revisionNumber?: number }
) {
  const reason = input?.reason?.trim();
  if (!reason) {
    return {
      ok: false as const,
      status: 400,
      message: "İptal nedeni zorunludur.",
    };
  }

  const sale = await db.sale.findFirst({
    where: {
      id: saleId,
      companyId,
    },
    include: {
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
      invoice: {
        include: {
          documentSubmission: true,
        },
      },
      customer: true,
    },
  });

  if (!sale) {
    return { ok: false as const, status: 404, message: "Satış bulunamadı." };
  }

  const eligibility = validateSaleCancelEligibility(sale);
  if (!eligibility.ok) {
    return {
      ok: false as const,
      status: 400,
      message: eligibility.message,
    };
  }

  const lifecycle = mapSaleToLifecycle(sale.status);
  try {
    assertLifecycleAction({
      module: "sales",
      state: lifecycle,
      action: "cancel",
      message: "Bu satış iptal edilemez.",
    });
    assertCancelReasonProvided({ state: lifecycle, reason });
  } catch (error) {
    return {
      ok: false as const,
      status: 400,
      message:
        error instanceof Error ? error.message : "Bu satış iptal edilemez.",
    };
  }

  if (
    input?.revisionNumber !== undefined &&
    sale.revisionNumber !== input.revisionNumber
  ) {
    return {
      ok: false as const,
      status: 409,
      message: "SALE_VERSION_CONFLICT: Bu satış başka bir işlem tarafından güncellenmiş. Sayfayı yenileyip tekrar deneyin.",
    };
  }

  await db.$transaction(async (tx) => {
    await reverseSaleEffects(tx, {
      sale,
      companyId,
      userId,
      reason,
      note: input?.note,
    });
  });

  invalidateDashboardCache(companyId, "sale-cancel");

  return {
    ok: true as const,
    message: "Satış tamamen iptal edildi. Stok ve toplamlar güncellendi.",
  };
}
