import {
  executeWarehouseTransfer,
  cancelWarehouseTransferAtomic,
} from "@/lib/warehouse-transfer-service";
import {
  normalizeWarehouseTransferItems,
  type NormalizedWarehouseTransferInput,
} from "@/lib/warehouse-transfer-utils";
import type { Prisma } from "@prisma/client";
import { calculateWarehouseStockValue } from "@/lib/inventory-value-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import { resolveProductMinStock } from "@/lib/stocks-page-utils";
import { db } from "@/lib/prisma";
import { syncProductStockFromWarehouses } from "@/lib/product-stock-sync-service";
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

export { generateTransferNo } from "@/lib/warehouse-transfer-utils";

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
  return syncProductStockFromWarehouses(companyId, productId, tx);
}

export { syncProductStockFromWarehouses } from "@/lib/product-stock-sync-service";
export { reconcileCompanyProductStocks } from "@/lib/product-stock-sync-service";

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

    if (isServiceProductType(product.productType)) {
      return {
        ok: false as const,
        status: 400,
        message: "Hizmet kalemleri için stok hareketi yapılamaz.",
        errors: { productId: ["Hizmet kalemleri için stok hareketi yapılamaz."] },
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

    let movementSupplierId: string | null = null;
    if (input.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: {
          id: input.supplierId,
          companyId,
          isActive: true,
        },
      });
      if (!supplier) {
        return {
          ok: false as const,
          status: 400,
          message: "Seçilen tedarikçi bulunamadı veya pasif.",
          errors: { supplierId: ["Seçilen tedarikçi bulunamadı veya pasif."] },
        };
      }
      movementSupplierId = supplier.id;
    }

    const stockMovement = await tx.stockMovement.create({
      data: {
        companyId,
        productId,
        warehouseId,
        supplierId: movementSupplierId,
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
  idempotencyKey?: string | null;
  items?: Array<{ productId: string; quantity: number }>;
};

export async function moveStockBetweenWarehouses(
  input: MoveStockBetweenWarehousesParams
) {
  const normalizedItems = input.items?.length
    ? { ok: true as const, items: input.items }
    : normalizeWarehouseTransferItems({
        productId: input.productId,
        quantity: input.quantity,
      });

  if (!normalizedItems.ok) {
    return {
      ok: false as const,
      status: 400,
      message: normalizedItems.message,
    };
  }

  const transferInput: NormalizedWarehouseTransferInput = {
    companyId: input.companyId,
    userId: input.userId,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    items: normalizedItems.items,
    note: input.note,
    transferDate: input.transferDate,
    idempotencyKey: input.idempotencyKey,
  };

  const result = await executeWarehouseTransfer(transferInput);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true as const,
    replayed: result.replayed ?? false,
    data: {
      transfer: result.data,
      replayed: result.replayed ?? false,
    },
  };
}

export async function cancelWarehouseTransfer(
  companyId: string,
  userId: string,
  transferId: string
) {
  return cancelWarehouseTransferAtomic(companyId, userId, transferId);
}

export type WarehouseListItem = Prisma.WarehouseGetPayload<{
  include: {
    stocks: {
      include: {
        product: {
          select: {
            buyPrice: true;
            productType: true;
            minStock: true;
            stock: true;
          };
        };
      };
    };
  };
}>;

export function buildWarehouseMetrics(warehouse: WarehouseListItem) {
  const stockItems = warehouse.stocks.filter(
    (stock) => !isServiceProductType(stock.product.productType)
  );
  const productCount = stockItems.filter((s) => s.quantity > 0).length;
  const totalStock = stockItems.reduce((sum, s) => sum + s.quantity, 0);
  const totalValue = calculateWarehouseStockValue(stockItems);
  const lowStockCount = stockItems.filter((s) => {
    if (s.quantity <= 0) return false;
    const minStock = resolveProductMinStock(s.product.minStock);
    return s.quantity <= minStock;
  }).length;

  return { productCount, totalStock, totalValue, lowStockCount };
}
