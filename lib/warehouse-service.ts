import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  calculateStockMovement,
  normalizeMovementNote,
  parseMovementDate,
  type StockMovementRequestInput,
} from "@/lib/stock-movement-utils";

export const DEFAULT_WAREHOUSE_NAME = "Ana Depo";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class WarehouseStockError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "WarehouseStockError";
  }
}

export function generateTransferNo() {
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `TRF-${year}-${suffix}`;
}

export async function getOrCreateDefaultWarehouse(
  companyId: string,
  tx: TransactionClient = db
) {
  const existing = await tx.warehouse.findFirst({
    where: {
      companyId,
      isDefault: true,
      status: "ACTIVE",
    },
  });

  if (existing) {
    return existing;
  }

  const fallback = await tx.warehouse.findFirst({
    where: { companyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  if (fallback) {
    if (!fallback.isDefault) {
      return tx.warehouse.update({
        where: { id: fallback.id },
        data: { isDefault: true },
      });
    }

    return fallback;
  }

  return tx.warehouse.create({
    data: {
      companyId,
      name: DEFAULT_WAREHOUSE_NAME,
      code: "MAIN",
      isDefault: true,
      status: "ACTIVE",
    },
  });
}

export async function resolveWarehouseId(
  companyId: string,
  warehouseId: string | undefined | null,
  tx: TransactionClient = db
) {
  if (warehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: warehouseId,
        companyId,
        status: "ACTIVE",
      },
    });

    if (!warehouse) {
      throw new WarehouseStockError("Seçilen depo bulunamadı veya pasif.");
    }

    return warehouse.id;
  }

  const defaultWarehouse = await getOrCreateDefaultWarehouse(companyId, tx);
  return defaultWarehouse.id;
}

export async function ensureProductWarehouseStock(
  companyId: string,
  productId: string,
  warehouseId: string,
  tx: TransactionClient = db
) {
  const existing = await tx.warehouseStock.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId,
        productId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  const product = await tx.product.findFirst({
    where: { id: productId, companyId },
    select: { stock: true },
  });

  if (!product) {
    throw new WarehouseStockError("Ürün bulunamadı.");
  }

  const allWarehouseStocks = await tx.warehouseStock.findMany({
    where: { companyId, productId },
    select: { quantity: true },
  });

  let initialQuantity = 0;

  if (allWarehouseStocks.length === 0 && product.stock > 0) {
    const defaultWarehouse = await getOrCreateDefaultWarehouse(companyId, tx);
    initialQuantity = warehouseId === defaultWarehouse.id ? product.stock : 0;
  }

  return tx.warehouseStock.create({
    data: {
      companyId,
      warehouseId,
      productId,
      quantity: initialQuantity,
    },
  });
}

export async function syncProductTotalStock(
  companyId: string,
  productId: string,
  tx: TransactionClient = db
) {
  const aggregate = await tx.warehouseStock.aggregate({
    where: { companyId, productId },
    _sum: { quantity: true },
  });

  const total = aggregate._sum.quantity ?? 0;

  return tx.product.update({
    where: { id: productId },
    data: { stock: total },
  });
}

export async function getProductStockByWarehouses(
  companyId: string,
  productId: string
) {
  const stocks = await db.warehouseStock.findMany({
    where: { companyId, productId },
    include: {
      warehouse: {
        select: {
          id: true,
          name: true,
          code: true,
          isDefault: true,
          status: true,
        },
      },
    },
    orderBy: [{ warehouse: { isDefault: "desc" } }, { warehouse: { name: "asc" } }],
  });

  return stocks;
}

export async function getDefaultWarehouseStockQuantity(
  tx: TransactionClient,
  companyId: string,
  productId: string
) {
  const defaultWarehouse = await getOrCreateDefaultWarehouse(companyId, tx);
  return getWarehouseStockQuantity(
    tx,
    companyId,
    productId,
    defaultWarehouse.id
  );
}

export async function getWarehouseStockQuantity(
  tx: TransactionClient,
  companyId: string,
  productId: string,
  warehouseId: string
) {
  const warehouse = await tx.warehouse.findFirst({
    where: {
      id: warehouseId,
      companyId,
      status: "ACTIVE",
    },
  });

  if (!warehouse) {
    throw new WarehouseStockError("Seçilen depo bulunamadı veya pasif.");
  }

  const warehouseStock = await ensureProductWarehouseStock(
    companyId,
    productId,
    warehouse.id,
    tx
  );

  return {
    warehouse,
    quantity: warehouseStock.quantity,
  };
}

type ApplyWarehouseStockMovementParams = {
  companyId: string;
  userId: string;
  productId: string;
  input: StockMovementRequestInput & { warehouseId?: string };
};

export async function applyWarehouseStockMovement({
  companyId,
  userId,
  productId,
  input,
}: ApplyWarehouseStockMovementParams) {
  const movementDate = parseMovementDate(input.movementDate);
  if (!movementDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir işlem tarihi girin.",
      errors: { movementDate: ["Geçerli bir işlem tarihi girin."] },
    };
  }

  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, companyId },
    });

    if (!product) {
      return {
        ok: false as const,
        status: 404,
        message: "Ürün bulunamadı.",
      };
    }

    let warehouseId: string;
    try {
      warehouseId = await resolveWarehouseId(companyId, input.warehouseId, tx);
    } catch (error) {
      if (error instanceof WarehouseStockError) {
        return {
          ok: false as const,
          status: 400,
          message: error.message,
          errors: { warehouseId: [error.message] },
        };
      }
      throw error;
    }

    const warehouseStock = await ensureProductWarehouseStock(
      companyId,
      productId,
      warehouseId,
      tx
    );

    const calculation = calculateStockMovement(
      input.type,
      warehouseStock.quantity,
      input.quantity
    );

    if ("error" in calculation) {
      return {
        ok: false as const,
        status: 400,
        message: calculation.error,
        errors: { quantity: [calculation.error] },
      };
    }

    const { newStock, movementQuantity, dbType } = calculation;

    await tx.warehouseStock.update({
      where: { id: warehouseStock.id },
      data: { quantity: newStock },
    });

    const stockMovement = await tx.stockMovement.create({
      data: {
        companyId,
        productId,
        warehouseId,
        type: dbType,
        quantity: movementQuantity,
        note: normalizeMovementNote(input.note),
        movementDate,
      },
    });

    const updatedProduct = await syncProductTotalStock(companyId, productId, tx);

    const warehouseLocation = input.warehouseLocation?.trim();
    if (warehouseLocation) {
      await tx.product.update({
        where: { id: productId },
        data: { warehouseLocation },
      });
    }

    await tx.activityLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        module: "stocks",
        message: `${product.name} için ${dbType} hareketi kaydedildi. Depo stoğu: ${newStock}, toplam stok: ${updatedProduct.stock}.`,
      },
    });

    return {
      ok: true as const,
      data: {
        product: updatedProduct,
        stockMovement,
        previousStock: product.stock,
        newStock: updatedProduct.stock,
        warehouseStock: newStock,
        movementQuantity,
      },
    };
  });
}

type MoveStockBetweenWarehousesParams = {
  companyId: string;
  userId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  note?: string | null;
  transferDate?: string | null;
};

export async function moveStockBetweenWarehouses(
  input: MoveStockBetweenWarehousesParams
) {
  const movementDate = parseMovementDate(input.transferDate);
  if (!movementDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir transfer tarihi girin.",
    };
  }

  if (input.fromWarehouseId === input.toWarehouseId) {
    return {
      ok: false as const,
      status: 400,
      message: "Çıkış ve giriş deposu aynı olamaz.",
    };
  }

  if (input.quantity <= 0) {
    return {
      ok: false as const,
      status: 400,
      message: "Transfer miktarı 0'dan büyük olmalıdır.",
    };
  }

  return db.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, companyId: input.companyId },
    });

    if (!product) {
      return {
        ok: false as const,
        status: 404,
        message: "Ürün bulunamadı.",
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

    const fromStock = await ensureProductWarehouseStock(
      input.companyId,
      input.productId,
      fromWarehouse.id,
      tx
    );

    if (fromStock.quantity < input.quantity) {
      return {
        ok: false as const,
        status: 400,
        message: `${fromWarehouse.name} deposunda yeterli stok yok. Mevcut: ${fromStock.quantity}`,
      };
    }

    const toStock = await ensureProductWarehouseStock(
      input.companyId,
      input.productId,
      toWarehouse.id,
      tx
    );

    const transferNo = generateTransferNo();

    const transfer = await tx.warehouseTransfer.create({
      data: {
        companyId: input.companyId,
        transferNo,
        fromWarehouseId: fromWarehouse.id,
        toWarehouseId: toWarehouse.id,
        productId: input.productId,
        quantity: input.quantity,
        note: normalizeMovementNote(input.note),
        status: "COMPLETED",
        createdByUserId: input.userId,
      },
    });

    await tx.warehouseStock.update({
      where: { id: fromStock.id },
      data: { quantity: fromStock.quantity - input.quantity },
    });

    await tx.warehouseStock.update({
      where: { id: toStock.id },
      data: { quantity: toStock.quantity + input.quantity },
    });

    const [transferOut, transferIn] = await Promise.all([
      tx.stockMovement.create({
        data: {
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: fromWarehouse.id,
          transferId: transfer.id,
          type: "TRANSFER_OUT",
          quantity: -input.quantity,
          note: `${transferNo} depo transferi (${fromWarehouse.name} → ${toWarehouse.name})`,
          movementDate,
        },
      }),
      tx.stockMovement.create({
        data: {
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: toWarehouse.id,
          transferId: transfer.id,
          type: "TRANSFER_IN",
          quantity: input.quantity,
          note: `${transferNo} depo transferi (${fromWarehouse.name} → ${toWarehouse.name})`,
          movementDate,
        },
      }),
    ]);

    await syncProductTotalStock(input.companyId, input.productId, tx);

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        module: "stocks",
        message: `${transferNo}: ${product.name} ${input.quantity} adet ${fromWarehouse.name} → ${toWarehouse.name} transfer edildi.`,
      },
    });

    return {
      ok: true as const,
      data: {
        transfer,
        transferOut,
        transferIn,
        productStock: product.stock,
      },
    };
  });
}

export async function cancelWarehouseTransfer(
  companyId: string,
  userId: string,
  transferId: string
) {
  return db.$transaction(async (tx) => {
    const transfer = await tx.warehouseTransfer.findFirst({
      where: { id: transferId, companyId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        product: true,
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

    const toStock = await ensureProductWarehouseStock(
      companyId,
      transfer.productId,
      transfer.toWarehouseId,
      tx
    );

    if (toStock.quantity < transfer.quantity) {
      return {
        ok: false as const,
        status: 400,
        message: `${transfer.toWarehouse.name} deposunda iptal için yeterli stok yok. Mevcut: ${toStock.quantity}`,
      };
    }

    const fromStock = await ensureProductWarehouseStock(
      companyId,
      transfer.productId,
      transfer.fromWarehouseId,
      tx
    );

    await tx.warehouseStock.update({
      where: { id: toStock.id },
      data: { quantity: toStock.quantity - transfer.quantity },
    });

    await tx.warehouseStock.update({
      where: { id: fromStock.id },
      data: { quantity: fromStock.quantity + transfer.quantity },
    });

    await tx.warehouseTransfer.update({
      where: { id: transfer.id },
      data: { status: "CANCELLED" },
    });

    const cancelNote = `${transfer.transferNo} transferi iptal edildi`;

    await Promise.all([
      tx.stockMovement.create({
        data: {
          companyId,
          productId: transfer.productId,
          warehouseId: transfer.toWarehouseId,
          transferId: transfer.id,
          type: "TRANSFER_OUT",
          quantity: -transfer.quantity,
          note: cancelNote,
        },
      }),
      tx.stockMovement.create({
        data: {
          companyId,
          productId: transfer.productId,
          warehouseId: transfer.fromWarehouseId,
          transferId: transfer.id,
          type: "TRANSFER_IN",
          quantity: transfer.quantity,
          note: cancelNote,
        },
      }),
    ]);

    await syncProductTotalStock(companyId, transfer.productId, tx);

    await tx.activityLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        module: "stocks",
        message: `${transfer.transferNo} depo transferi iptal edildi.`,
      },
    });

    return {
      ok: true as const,
      data: { transferId: transfer.id },
    };
  });
}

export type WarehouseListItem = Prisma.WarehouseGetPayload<{
  include: {
    stocks: {
      include: {
        product: {
          select: {
            sellPrice: true;
            minStock: true;
            stock: true;
          };
        };
      };
    };
  };
}>;

export function buildWarehouseMetrics(warehouse: WarehouseListItem) {
  const productCount = warehouse.stocks.filter((s) => s.quantity > 0).length;
  const totalStock = warehouse.stocks.reduce((sum, s) => sum + s.quantity, 0);
  const totalValue = warehouse.stocks.reduce(
    (sum, s) => sum + s.quantity * Number(s.product.sellPrice),
    0
  );
  const lowStockCount = warehouse.stocks.filter(
    (s) => s.quantity > 0 && s.quantity <= s.product.minStock
  ).length;

  return { productCount, totalStock, totalValue, lowStockCount };
}
