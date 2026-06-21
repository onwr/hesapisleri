import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { syncProductStockFromWarehouses } from "@/lib/product-stock-sync-service";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  isPrismaUniqueConstraintError,
  isRetryableTransactionError,
  runTransactionWithRetry,
} from "@/lib/prisma-transaction-utils";
import { normalizeMovementNote, parseMovementDate } from "@/lib/stock-movement-utils";
import {
  buildWarehouseTransferPayloadHash,
  generateTransferNo,
  getTransferItemsForCancel,
  IDEMPOTENCY_CONFLICT_MESSAGE,
  SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE,
  SERVICE_TRANSFER_ERROR_MESSAGE,
  sumTransferItemQuantities,
  TRANSFER_BUSY_MESSAGE,
  type NormalizedTransferItem,
  type NormalizedWarehouseTransferInput,
} from "@/lib/warehouse-transfer-utils";

type TransactionClient = Prisma.TransactionClient;

export type WarehouseTransferResultData = {
  id: string;
  transferNo: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  itemCount: number;
  totalQuantity: number;
  status: string;
  completedAt: string | null;
  replayed: boolean;
};

type ServiceResult<T = WarehouseTransferResultData> =
  | { ok: true; data: T; replayed?: boolean }
  | { ok: false; status: number; message: string; errors?: Record<string, string[]> };

const transferInclude = {
  fromWarehouse: { select: { id: true, name: true } },
  toWarehouse: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } },
  items: { select: { id: true, productId: true, quantity: true } },
} as const;

function serializeTransferResult(
  transfer: {
    id: string;
    transferNo: string;
    status: string;
    completedAt: Date | null;
    quantity: number;
    fromWarehouse: { id: string; name: string };
    toWarehouse: { id: string; name: string };
    items?: Array<{ productId: string; quantity: number }>;
  },
  replayed = false
): WarehouseTransferResultData {
  const itemCount = transfer.items?.length ?? 1;

  return {
    id: transfer.id,
    transferNo: transfer.transferNo,
    sourceWarehouseId: transfer.fromWarehouse.id,
    sourceWarehouseName: transfer.fromWarehouse.name,
    destinationWarehouseId: transfer.toWarehouse.id,
    destinationWarehouseName: transfer.toWarehouse.name,
    itemCount,
    totalQuantity: transfer.quantity,
    status: transfer.status,
    completedAt: transfer.completedAt?.toISOString() ?? null,
    replayed,
  };
}

async function findTransferByIdempotencyKey(
  companyId: string,
  idempotencyKey: string
) {
  return db.warehouseTransfer.findFirst({
    where: { companyId, idempotencyKey },
    include: transferInclude,
  });
}

import { applyWarehouseStockDelta } from "@/lib/warehouse-transfer-stock-utils";

async function executeTransferInTransaction(
  tx: TransactionClient,
  input: NormalizedWarehouseTransferInput,
  items: NormalizedTransferItem[],
  payloadHash: string,
  movementDate: Date
) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    return {
      ok: false as const,
      status: 400,
      message: SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE,
    };
  }

  const [fromWarehouse, toWarehouse] = await Promise.all([
    tx.warehouse.findFirst({
      where: {
        id: input.fromWarehouseId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    }),
    tx.warehouse.findFirst({
      where: {
        id: input.toWarehouseId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    }),
  ]);

  if (!fromWarehouse || !toWarehouse) {
    return {
      ok: false as const,
      status: 400,
      message: "Depo bulunamadı veya pasif.",
    };
  }

  const products = await tx.product.findMany({
    where: {
      companyId: input.companyId,
      id: { in: items.map((item) => item.productId) },
    },
    select: {
      id: true,
      name: true,
      productType: true,
    },
  });

  if (products.length !== items.length) {
    return {
      ok: false as const,
      status: 404,
      message: "Ürün bulunamadı.",
    };
  }

  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      return {
        ok: false as const,
        status: 404,
        message: "Ürün bulunamadı.",
      };
    }

    if (isServiceProductType(product.productType)) {
      return {
        ok: false as const,
        status: 400,
        message: SERVICE_TRANSFER_ERROR_MESSAGE,
      };
    }
  }

  if (input.idempotencyKey) {
    const existing = await tx.warehouseTransfer.findFirst({
      where: {
        companyId: input.companyId,
        idempotencyKey: input.idempotencyKey,
      },
      include: transferInclude,
    });

    if (existing?.status === "COMPLETED") {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        return {
          ok: false as const,
          status: 409,
          message: IDEMPOTENCY_CONFLICT_MESSAGE,
        };
      }

      return {
        ok: true as const,
        replayed: true,
        data: serializeTransferResult(existing, true),
      };
    }
  }

  const transferNo = generateTransferNo();
  const totalQuantity = sumTransferItemQuantities(items);
  const primaryProductId = items[0]!.productId;

  const transfer = await tx.warehouseTransfer.create({
    data: {
      companyId: input.companyId,
      transferNo,
      fromWarehouseId: fromWarehouse.id,
      toWarehouseId: toWarehouse.id,
      productId: primaryProductId,
      quantity: totalQuantity,
      note: normalizeMovementNote(input.note),
      status: "PENDING",
      idempotencyKey: input.idempotencyKey ?? null,
      payloadHash,
      createdByUserId: input.userId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
    include: transferInclude,
  });

  const movementNoteBase = `${transferNo} depo transferi (${fromWarehouse.name} → ${toWarehouse.name})`;

  for (const item of items) {
    await applyWarehouseStockDelta(tx, {
      companyId: input.companyId,
      warehouseId: fromWarehouse.id,
      productId: item.productId,
      delta: -item.quantity,
    });

    await applyWarehouseStockDelta(tx, {
      companyId: input.companyId,
      warehouseId: toWarehouse.id,
      productId: item.productId,
      delta: item.quantity,
    });

    await tx.stockMovement.create({
      data: {
        companyId: input.companyId,
        productId: item.productId,
        warehouseId: fromWarehouse.id,
        transferId: transfer.id,
        type: "TRANSFER_OUT",
        quantity: -item.quantity,
        note: movementNoteBase,
        movementDate,
      },
    });

    await tx.stockMovement.create({
      data: {
        companyId: input.companyId,
        productId: item.productId,
        warehouseId: toWarehouse.id,
        transferId: transfer.id,
        type: "TRANSFER_IN",
        quantity: item.quantity,
        note: movementNoteBase,
        movementDate,
      },
    });
  }

  const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
  for (const productId of uniqueProductIds) {
    await syncProductStockFromWarehouses(input.companyId, productId, tx);
  }

  const completedTransfer = await tx.warehouseTransfer.update({
    where: { id: transfer.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
    include: transferInclude,
  });

  await tx.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "STOCK_TRANSFER",
      module: "products",
      message: `Depo transferi tamamlandı: ${fromWarehouse.name} → ${toWarehouse.name} · ${items.length} kalem`,
    },
  });

  return {
    ok: true as const,
    replayed: false,
    data: serializeTransferResult(completedTransfer, false),
  };
}

export async function executeWarehouseTransfer(
  input: NormalizedWarehouseTransferInput
): Promise<ServiceResult> {
  const movementDate = parseMovementDate(input.transferDate);
  if (!movementDate) {
    return {
      ok: false,
      status: 400,
      message: "Geçerli bir transfer tarihi girin.",
    };
  }

  if (input.fromWarehouseId === input.toWarehouseId) {
    return {
      ok: false,
      status: 400,
      message: SAME_WAREHOUSE_TRANSFER_ERROR_MESSAGE,
    };
  }

  const payloadHash = buildWarehouseTransferPayloadHash({
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    items: input.items,
    note: input.note,
  });

  if (input.idempotencyKey) {
    const existing = await findTransferByIdempotencyKey(
      input.companyId,
      input.idempotencyKey
    );

    if (existing?.status === "COMPLETED") {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        return {
          ok: false,
          status: 409,
          message: IDEMPOTENCY_CONFLICT_MESSAGE,
        };
      }

      return {
        ok: true,
        replayed: true,
        data: serializeTransferResult(existing, true),
      };
    }
  }

  try {
    const result = await runTransactionWithRetry((tx) =>
      executeTransferInTransaction(
        tx,
        input,
        input.items,
        payloadHash,
        movementDate
      )
    );

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      replayed: result.replayed,
      data: result.data,
    };
  } catch (error) {
    if (
      input.idempotencyKey &&
      isPrismaUniqueConstraintError(error, "idempotencyKey")
    ) {
      const existing = await findTransferByIdempotencyKey(
        input.companyId,
        input.idempotencyKey
      );

      if (existing?.status === "COMPLETED") {
        if (existing.payloadHash && existing.payloadHash !== payloadHash) {
          return {
            ok: false,
            status: 409,
            message: IDEMPOTENCY_CONFLICT_MESSAGE,
          };
        }

        return {
          ok: true,
          replayed: true,
          data: serializeTransferResult(existing, true),
        };
      }
    }

    if (isRetryableTransactionError(error)) {
      return {
        ok: false,
        status: 503,
        message: TRANSFER_BUSY_MESSAGE,
      };
    }

    throw error;
  }
}

export async function cancelWarehouseTransferAtomic(
  companyId: string,
  userId: string,
  transferId: string
): Promise<ServiceResult<{ transferId: string }>> {
  try {
    const result = await runTransactionWithRetry(async (tx) => {
      const transfer = await tx.warehouseTransfer.findFirst({
        where: { id: transferId, companyId },
        include: {
          fromWarehouse: true,
          toWarehouse: true,
          product: true,
          items: { select: { productId: true, quantity: true } },
        },
      });

      if (!transfer) {
        return {
          ok: false as const,
          status: 404,
          message: "Transfer bulunamadı.",
        };
      }

      if (transfer.status === "CANCELLED") {
        return {
          ok: false as const,
          status: 400,
          message: "Bu transfer zaten iptal edilmiş.",
        };
      }

      const items = getTransferItemsForCancel(transfer);
      const cancelNote = `${transfer.transferNo} transferi iptal edildi`;

      for (const item of items) {
        await applyWarehouseStockDelta(tx, {
          companyId,
          warehouseId: transfer.toWarehouseId,
          productId: item.productId,
          delta: -item.quantity,
        });

        await applyWarehouseStockDelta(tx, {
          companyId,
          warehouseId: transfer.fromWarehouseId,
          productId: item.productId,
          delta: item.quantity,
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            transferId: transfer.id,
            type: "TRANSFER_OUT",
            quantity: -item.quantity,
            note: cancelNote,
          },
        });

        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
            transferId: transfer.id,
            type: "TRANSFER_IN",
            quantity: item.quantity,
            note: cancelNote,
          },
        });
      }

      await tx.warehouseTransfer.update({
        where: { id: transfer.id },
        data: { status: "CANCELLED" },
      });

      const uniqueProductIds = [...new Set(items.map((item) => item.productId))];
      for (const productId of uniqueProductIds) {
        await syncProductStockFromWarehouses(companyId, productId, tx);
      }

      await tx.activityLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          module: "stocks",
          message: `${transfer.transferNo}: ${transfer.product.name} transferi iptal edildi.`,
        },
      });

      return {
        ok: true as const,
        data: { transferId: transfer.id },
      };
    });

    if (result.ok) {
      return result;
    }

    return result;
  } catch (error) {
    if (isRetryableTransactionError(error)) {
      return {
        ok: false,
        status: 503,
        message: TRANSFER_BUSY_MESSAGE,
      };
    }

    throw error;
  }
}
