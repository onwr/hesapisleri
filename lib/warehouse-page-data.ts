import {
  calculateWarehouseStockValue,
} from "@/lib/inventory-value-utils";
import { db } from "@/lib/prisma";
import {
  buildWarehouseMetrics,
  getOrCreateDefaultWarehouse,
} from "@/lib/warehouse-service";
import { isLowStock, resolveProductMinStock } from "@/lib/stocks-page-utils";

export type RecentTransferRow = {
  id: string;
  transferNo: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  itemCount: number;
  totalQuantity: number;
  status: string;
  createdAt: string;
};

export async function getWarehousesPageData(companyId: string) {
  await getOrCreateDefaultWarehouse(companyId);

  const [warehouses, movementAgg, rawTransfers, products] = await Promise.all([
    db.warehouse.findMany({
      where: { companyId },
      include: {
        stocks: {
          include: {
            product: {
              select: {
                buyPrice: true,
                productType: true,
                minStock: true,
                stock: true,
              },
            },
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.stockMovement.groupBy({
      by: ["warehouseId"],
      where: { companyId, warehouseId: { not: null } },
      _max: { createdAt: true },
    }),
    db.warehouseTransfer.findMany({
      where: { companyId },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.product.findMany({
      where: { companyId, productType: "STOCK" },
      select: { stock: true, buyPrice: true, minStock: true },
    }),
  ]);

  const lastMovementMap = new Map(
    movementAgg
      .filter((row) => row.warehouseId)
      .map((row) => [row.warehouseId as string, row._max.createdAt])
  );

  const warehouseRows = warehouses.map((warehouse) => {
    const metrics = buildWarehouseMetrics(warehouse);

    return {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      note: warehouse.note,
      address: warehouse.address,
      isDefault: warehouse.isDefault,
      status: warehouse.status,
      updatedAt: warehouse.updatedAt.toISOString(),
      lastMovementAt: lastMovementMap.get(warehouse.id)?.toISOString() ?? null,
      metrics,
    };
  });

  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter((w) => w.status === "ACTIVE").length;
  const totalStock = warehouseRows.reduce((sum, row) => sum + row.metrics.totalStock, 0);
  const totalStockValue = warehouseRows.reduce(
    (sum, row) => sum + row.metrics.totalValue,
    0
  );

  const productIds = new Set<string>();
  let warehouseLowStockPairs = 0;

  for (const warehouse of warehouses) {
    for (const stock of warehouse.stocks) {
      if (stock.quantity <= 0) continue;
      if (stock.product.productType === "SERVICE") continue;

      productIds.add(stock.productId);

      const minStock = resolveProductMinStock(stock.product.minStock);
      if (isLowStock(stock.quantity, minStock)) {
        warehouseLowStockPairs += 1;
      }
    }
  }

  const companyLowStockCount = products.filter((product) =>
    isLowStock(product.stock, resolveProductMinStock(product.minStock))
  ).length;

  const recentTransfers = buildRecentTransferRows(rawTransfers);

  return {
    warehouses: warehouseRows,
    recentTransfers,
    stats: {
      totalWarehouses,
      activeWarehouses,
      passiveWarehouses: warehouses.filter((w) => w.status === "PASSIVE").length,
      defaultWarehouseName:
        warehouses.find((w) => w.isDefault)?.name ?? "—",
      totalProductVariety: productIds.size,
      totalStock,
      totalStockValue,
      lowStockCount: warehouseLowStockPairs || companyLowStockCount,
    },
  };
}

function buildRecentTransferRows(
  transfers: Array<{
    id: string;
    transferNo: string;
    quantity: number;
    status: string;
    createdAt: Date;
    fromWarehouse: { name: string };
    toWarehouse: { name: string };
    items: Array<{ quantity: number }>;
  }>
): RecentTransferRow[] {
  const grouped = new Map<string, RecentTransferRow>();

  for (const transfer of transfers) {
    if (grouped.has(transfer.transferNo)) continue;

    const itemCount = transfer.items.length > 0 ? transfer.items.length : 1;
    const totalQuantity =
      transfer.items.length > 0
        ? transfer.items.reduce((sum, item) => sum + item.quantity, 0)
        : transfer.quantity;

    grouped.set(transfer.transferNo, {
      id: transfer.id,
      transferNo: transfer.transferNo,
      fromWarehouseName: transfer.fromWarehouse.name,
      toWarehouseName: transfer.toWarehouse.name,
      itemCount,
      totalQuantity,
      status: transfer.status,
      createdAt: transfer.createdAt.toISOString(),
    });
  }

  return Array.from(grouped.values()).slice(0, 5);
}

export async function getWarehouseDetailData(companyId: string, warehouseId: string) {
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    include: {
      stocks: {
        include: {
          product: {
            include: { category: true },
          },
        },
        orderBy: { quantity: "desc" },
      },
    },
  });

  if (!warehouse) return null;

  const metrics = buildWarehouseMetrics(warehouse);

  const [movements, transfers, lastMovement] = await Promise.all([
    db.stockMovement.findMany({
      where: { companyId, warehouseId },
      include: {
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.warehouseTransfer.findMany({
      where: {
        companyId,
        OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
      },
      include: {
        product: { select: { name: true } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.stockMovement.findFirst({
      where: { companyId, warehouseId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const stockRows = warehouse.stocks
    .filter((s) => s.quantity > 0 || s.product.stock > 0)
    .filter((s) => s.product.productType !== "SERVICE")
    .map((s) => {
      const lineValue = calculateWarehouseStockValue([
        {
          quantity: s.quantity,
          product: s.product,
        },
      ]);

      return {
        productId: s.product.id,
        productName: s.product.name,
        sku: s.product.sku,
        barcode: s.product.barcode,
        categoryName: s.product.category?.name || "Genel",
        warehouseStock: s.quantity,
        totalStock: s.product.stock,
        minStock: s.product.minStock,
        buyPrice: s.product.buyPrice,
        stockValue: lineValue,
        stockMovementHref: `/products/${s.product.id}/stock`,
      };
    });

  return {
    warehouse,
    metrics: {
      ...metrics,
      lastMovementAt: lastMovement?.createdAt.toISOString() ?? null,
    },
    stockRows,
    movements,
    transfers,
  };
}
