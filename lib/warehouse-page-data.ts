import { db } from "@/lib/prisma";
import {
  buildWarehouseMetrics,
  getOrCreateDefaultWarehouse,
} from "@/lib/warehouse-service";
import { isLowStock, resolveProductMinStock } from "@/lib/stocks-page-utils";

export async function getWarehousesPageData(companyId: string) {
  await getOrCreateDefaultWarehouse(companyId);

  const warehouses = await db.warehouse.findMany({
    where: { companyId },
    include: {
      stocks: {
        include: {
          product: {
            select: {
              sellPrice: true,
              minStock: true,
              stock: true,
            },
          },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const products = await db.product.findMany({
    where: { companyId },
    select: { stock: true, sellPrice: true, minStock: true },
  });

  const totalWarehouses = warehouses.length;
  const activeWarehouses = warehouses.filter((w) => w.status === "ACTIVE").length;
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalStockValue = products.reduce(
    (sum, p) => sum + p.stock * Number(p.sellPrice),
    0
  );
  const lowStockCount = products.filter((p) =>
    isLowStock(p.stock, resolveProductMinStock(p.minStock))
  ).length;

  return {
    warehouses: warehouses.map((warehouse) => ({
      ...warehouse,
      metrics: buildWarehouseMetrics(warehouse),
    })),
    stats: {
      totalWarehouses,
      activeWarehouses,
      totalStock,
      totalStockValue,
      lowStockCount,
    },
  };
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

  const movements = await db.stockMovement.findMany({
    where: { companyId, warehouseId },
    include: {
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const transfers = await db.warehouseTransfer.findMany({
    where: {
      companyId,
      OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }],
    },
    include: {
      product: { select: { name: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const stockRows = warehouse.stocks
    .filter((s) => s.quantity > 0 || s.product.stock > 0)
    .map((s) => ({
      productId: s.product.id,
      productName: s.product.name,
      sku: s.product.sku,
      categoryName: s.product.category?.name || "Genel",
      warehouseStock: s.quantity,
      totalStock: s.product.stock,
      minStock: s.product.minStock,
      stockMovementHref: `/products/${s.product.id}/stock`,
    }));

  return {
    warehouse,
    metrics,
    stockRows,
    movements,
    transfers,
  };
}
