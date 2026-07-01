import { db } from "@/lib/prisma";
import { applyProductStockMovement } from "@/lib/stock-movement-service";
import {
  stockMovementRequestSchema,
  type StockMovementRequestType,
} from "@/lib/stock-movement-utils";
import {
  isLowStock,
  resolveProductMinStock,
} from "@/lib/stocks-page-utils";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  buildWarehouseMetrics,
  getOrCreateDefaultWarehouse,
  moveStockBetweenWarehouses,
} from "@/lib/warehouse-service";
import { getWarehouseDetailData } from "@/lib/warehouse-page-data";
import {
  normalizeWarehouseTransferItems,
  warehouseTransferSchema,
} from "@/lib/warehouse-transfer-utils";
import { MobileCatalogError } from "./mobile-catalog-errors";
import { resolveMobileCatalogPermissions } from "./mobile-catalog-permissions";
import { mapCatalogError } from "./mobile-catalog-errors";

const PAGE_SIZE = 24;

export type MobileStockAdjustType = "IN" | "OUT" | "SET";

function mapMobileAdjustType(type: MobileStockAdjustType): StockMovementRequestType {
  if (type === "SET") return "COUNT";
  return type;
}

export async function listMobileStocks(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  warehouseId?: string;
  q?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  status?: string;
  cursor?: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.stocks.read) {
    throw new MobileCatalogError("FORBIDDEN", "Stok görüntüleme yetkiniz yok.", 403);
  }

  const q = input.q?.trim() ?? "";

  const rows = await db.warehouseStock.findMany({
    where: {
      companyId: input.companyId,
      ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
      product: {
        productType: "STOCK",
        ...(input.status ? { status: input.status as "ACTIVE" | "PASSIVE" } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q } },
              ],
            }
          : {}),
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          minStock: true,
          status: true,
          productType: true,
        },
      },
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ product: { name: "asc" } }],
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  let items = rows.map((row) => {
    const minStock = resolveProductMinStock(row.product.minStock);
    const outOfStock = row.quantity <= 0;
    const lowStock = isLowStock(row.quantity, minStock);
    return {
      id: row.id,
      product: {
        id: row.product.id,
        name: row.product.name,
        sku: row.product.sku,
        barcode: row.product.barcode,
        status: row.product.status,
      },
      warehouse: {
        id: row.warehouse.id,
        name: row.warehouse.name,
        code: row.warehouse.code,
      },
      quantity: row.quantity,
      minStock,
      lowStock,
      outOfStock,
      stockTracked: true,
    };
  });

  if (input.lowStock) items = items.filter((i) => i.lowStock);
  if (input.outOfStock) items = items.filter((i) => i.outOfStock);

  const hasMore = items.length > PAGE_SIZE;
  if (hasMore) items = items.slice(0, PAGE_SIZE);

  return {
    permissions,
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function listMobileLowStock(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  warehouseId?: string;
  cursor?: string;
}) {
  const result = await listMobileStocks({
    ...input,
    lowStock: true,
  });

  const items = result.items.map((item) => ({
    ...item,
    shortage: Math.max(0, item.minStock - item.quantity + 1),
  }));

  return { ...result, items };
}

export async function listMobileWarehouses(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.warehouses.read) {
    throw new MobileCatalogError("FORBIDDEN", "Depo görüntüleme yetkiniz yok.", 403);
  }

  await getOrCreateDefaultWarehouse(input.companyId);

  const warehouses = await db.warehouse.findMany({
    where: { companyId: input.companyId },
    include: {
      stocks: {
        include: {
          product: { select: { minStock: true, productType: true, stock: true } },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return {
    permissions,
    items: warehouses.map((w) => {
      const metrics = buildWarehouseMetrics(w);
      return {
        id: w.id,
        name: w.name,
        code: w.code,
        status: w.status,
        isDefault: w.isDefault,
        productCount: metrics.productCount,
        totalQuantity: metrics.totalStock,
        lowStockCount: metrics.lowStockCount,
      };
    }),
  };
}

export async function getMobileWarehouseDetail(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  warehouseId: string;
  q?: string;
  lowStock?: boolean;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.warehouses.read) {
    throw new MobileCatalogError("FORBIDDEN", "Depo görüntüleme yetkiniz yok.", 403);
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: input.warehouseId, companyId: input.companyId },
    select: { id: true },
  });
  if (!warehouse) {
    throw new MobileCatalogError("WAREHOUSE_NOT_FOUND", "Depo bulunamadı.", 404);
  }

  const pageData = await getWarehouseDetailData(input.companyId, input.warehouseId);
  if (!pageData) {
    throw new MobileCatalogError("WAREHOUSE_NOT_FOUND", "Depo bulunamadı.", 404);
  }
  const q = input.q?.trim().toLocaleLowerCase("tr-TR") ?? "";

  let stocks = pageData.stockRows.map((s) => {
    const minStock = resolveProductMinStock(s.minStock);
    return {
      productId: s.productId,
      productName: s.productName,
      sku: s.sku,
      quantity: s.warehouseStock,
      minStock,
      lowStock: isLowStock(s.warehouseStock, minStock),
    };
  });

  if (q) {
    stocks = stocks.filter(
      (s) =>
        s.productName.toLocaleLowerCase("tr-TR").includes(q) ||
        (s.sku?.toLocaleLowerCase("tr-TR").includes(q) ?? false)
    );
  }
  if (input.lowStock) stocks = stocks.filter((s) => s.lowStock);

  const movements = await db.stockMovement.findMany({
    where: { companyId: input.companyId, warehouseId: input.warehouseId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      type: true,
      quantity: true,
      note: true,
      createdAt: true,
      product: { select: { id: true, name: true } },
    },
  });

  return {
    permissions,
    warehouse: {
      id: pageData.warehouse.id,
      name: pageData.warehouse.name,
      code: pageData.warehouse.code,
      status: pageData.warehouse.status,
      isDefault: pageData.warehouse.isDefault,
      address: pageData.warehouse.address,
      metrics: pageData.metrics,
    },
    stocks,
    recentMovements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: m.quantity,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      productId: m.product.id,
      productName: m.product.name,
    })),
  };
}

export async function adjustMobileStock(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  productId: string;
  warehouseId?: string;
  type: MobileStockAdjustType;
  quantity: number;
  note?: string;
  movementDate?: string;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.stocks.adjust) {
    throw new MobileCatalogError("FORBIDDEN", "Stok düzeltme yetkiniz yok.", 403);
  }

  const product = await db.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
    select: { id: true, productType: true, status: true },
  });
  if (!product) {
    throw new MobileCatalogError("PRODUCT_NOT_FOUND", "Ürün bulunamadı.", 404);
  }
  if (isServiceProductType(product.productType)) {
    throw new MobileCatalogError(
      "STOCK_TRACKING_DISABLED",
      "Hizmet ürünlerinde stok hareketi yapılamaz.",
      400
    );
  }
  if (product.status !== "ACTIVE") {
    throw new MobileCatalogError("PRODUCT_INACTIVE", "Pasif üründe stok işlemi yapılamaz.", 400);
  }

  const mappedType = mapMobileAdjustType(input.type);
  const parsed = stockMovementRequestSchema.safeParse({
    type: mappedType,
    quantity: input.quantity,
    warehouseId: input.warehouseId,
    note: input.note,
    movementDate: input.movementDate,
  });

  if (!parsed.success) {
    throw new MobileCatalogError(
      "INVALID_STOCK_QUANTITY",
      parsed.error.issues[0]?.message ?? "Geçersiz stok miktarı.",
      400
    );
  }

  try {
    await applyProductStockMovement({
      companyId: input.companyId,
      userId: input.userId,
      productId: input.productId,
      input: parsed.data,
    });
  } catch (error) {
    const mapped = mapCatalogError(error);
    if (mapped) throw mapped;
    throw error;
  }

  return { success: true };
}

export async function transferMobileStock(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileCatalogPermissions(input.role, input.isOwner);
  if (!permissions.stocks.transfer) {
    throw new MobileCatalogError("FORBIDDEN", "Depo transfer yetkiniz yok.", 403);
  }

  const parsed = warehouseTransferSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileCatalogError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Transfer bilgileri geçersiz.",
      400
    );
  }

  const fromWarehouseId =
    parsed.data.sourceWarehouseId ?? parsed.data.fromWarehouseId ?? "";
  const toWarehouseId =
    parsed.data.destinationWarehouseId ?? parsed.data.toWarehouseId ?? "";

  if (fromWarehouseId === toWarehouseId) {
    throw new MobileCatalogError(
      "TRANSFER_SAME_WAREHOUSE",
      "Kaynak ve hedef depo farklı olmalıdır.",
      400
    );
  }

  const itemsResult = normalizeWarehouseTransferItems(parsed.data);
  if (!itemsResult.ok) {
    throw new MobileCatalogError("VALIDATION_ERROR", itemsResult.message, 400);
  }

  try {
    const result = await moveStockBetweenWarehouses({
      companyId: input.companyId,
      userId: input.userId,
      fromWarehouseId,
      toWarehouseId,
      productId: itemsResult.items[0]!.productId,
      quantity: itemsResult.items[0]!.quantity,
      items: itemsResult.items,
      note: parsed.data.note,
      transferDate: parsed.data.transferDate,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    if (!result.ok) {
      throw new MobileCatalogError(
        "INSUFFICIENT_STOCK",
        result.message ?? "Transfer tamamlanamadı.",
        result.status ?? 400
      );
    }
  } catch (error) {
    const mapped = mapCatalogError(error);
    if (mapped) throw mapped;
    throw error;
  }

  return { success: true };
}
