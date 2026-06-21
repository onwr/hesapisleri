import { db } from "@/lib/prisma";
import { isServiceProductType } from "@/lib/product-type-utils";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type ProductStockSyncSummary = {
  updated: number;
  unchanged: number;
  backfilled: number;
  skipped: number;
};

const DEFAULT_WAREHOUSE_NAME = "Ana Depo";

async function getOrCreateDefaultWarehouseId(companyId: string) {
  const existing = await db.warehouse.findFirst({
    where: { companyId, isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const fallback = await db.warehouse.findFirst({
    where: { companyId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (fallback) {
    await db.warehouse.update({
      where: { id: fallback.id },
      data: { isDefault: true },
    });
    return fallback.id;
  }

  const created = await db.warehouse.create({
    data: {
      companyId,
      name: DEFAULT_WAREHOUSE_NAME,
      code: "MAIN",
      isDefault: true,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return created.id;
}

export async function calculateProductStockFromWarehouses(
  companyId: string,
  productId: string,
  tx: TransactionClient = db
) {
  const aggregate = await tx.warehouseStock.aggregate({
    where: { companyId, productId },
    _sum: { quantity: true },
  });

  return aggregate._sum.quantity ?? 0;
}

export async function syncProductStockFromWarehouses(
  companyId: string,
  productId: string,
  tx: TransactionClient = db
) {
  const product = await tx.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true, productType: true, stock: true },
  });

  if (!product || isServiceProductType(product.productType)) {
    return tx.product.findFirstOrThrow({
      where: { id: productId },
    });
  }

  const total = await calculateProductStockFromWarehouses(
    companyId,
    productId,
    tx
  );

  return tx.product.update({
    where: { id: productId },
    data: { stock: total },
  });
}

/** @deprecated use syncProductStockFromWarehouses */
export const syncProductTotalStock = syncProductStockFromWarehouses;

export async function syncManyProductStocks(
  companyId: string,
  productIds: string[]
) {
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const productId of productIds) {
    const result = await syncOneProductStockIfNeeded(companyId, productId);
    if (result.skipped) skipped += 1;
    else if (result.changed) updated += 1;
    else unchanged += 1;
  }

  return { updated, unchanged, backfilled: 0, skipped };
}

async function syncOneProductStockIfNeeded(
  companyId: string,
  productId: string,
  options?: { backfillMissingWarehouse?: boolean }
) {
  const product = await db.product.findFirst({
    where: { id: productId, companyId },
    select: { id: true, stock: true, productType: true },
  });

  if (!product) {
    return { changed: false, backfilled: false, skipped: false };
  }

  if (isServiceProductType(product.productType)) {
    return { changed: false, backfilled: false, skipped: true };
  }

  const warehouseCount = await db.warehouseStock.count({
    where: { companyId, productId },
  });

  if (
    options?.backfillMissingWarehouse !== false &&
    warehouseCount === 0 &&
    product.stock > 0
  ) {
    const defaultWarehouseId = await getOrCreateDefaultWarehouseId(companyId);
    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId: defaultWarehouseId,
        productId,
        quantity: product.stock,
      },
    });
    return { changed: false, backfilled: true, skipped: false };
  }

  const warehouseTotal = await calculateProductStockFromWarehouses(
    companyId,
    productId
  );

  if (warehouseTotal === product.stock) {
    return { changed: false, backfilled: false, skipped: false };
  }

  await syncProductStockFromWarehouses(companyId, productId);
  return { changed: true, backfilled: false, skipped: false };
}

export async function syncAllProductStocksForCompany(
  companyId: string
): Promise<ProductStockSyncSummary> {
  const products = await db.product.findMany({
    where: { companyId, productType: "STOCK" },
    select: { id: true },
  });

  let updated = 0;
  let unchanged = 0;
  let backfilled = 0;
  let skipped = 0;

  const serviceCount = await db.product.count({
    where: { companyId, productType: "SERVICE" },
  });
  skipped = serviceCount;

  for (const product of products) {
    const result = await syncOneProductStockIfNeeded(companyId, product.id);
    if (result.backfilled) backfilled += 1;
    else if (result.changed) updated += 1;
    else unchanged += 1;
  }

  return { updated, unchanged, backfilled, skipped };
}

/** @deprecated use syncAllProductStocksForCompany via POST /api/products/sync-stock */
export async function reconcileCompanyProductStocks(companyId: string) {
  await syncAllProductStocksForCompany(companyId);
}
