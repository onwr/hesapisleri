import { db } from "@/lib/prisma";
import {
  buildInsufficientStockWarning,
  type StockWarningItem,
} from "@/lib/stock-policy";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  ensureProductWarehouseStock,
  getWarehouseStockQuantity,
  resolveWarehouseId,
  syncProductTotalStock,
} from "@/lib/warehouse-service";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

type SaleItemInput = {
  productId?: string;
  quantity: number;
  name: string;
  warehouseId?: string;
};

export class SaleStockValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "SaleStockValidationError";
  }
}

function aggregateQuantitiesByProduct(items: SaleItemInput[]) {
  const map = new Map<string, number>();

  for (const item of items) {
    if (!item.productId) continue;
    map.set(
      item.productId,
      (map.get(item.productId) ?? 0) + item.quantity
    );
  }

  return map;
}

export async function validateSaleItemsStock(
  tx: TransactionClient,
  companyId: string,
  items: SaleItemInput[],
  saleWarehouseId?: string | null
): Promise<StockWarningItem[]> {
  const quantitiesByProduct = aggregateQuantitiesByProduct(items);
  const warnings: StockWarningItem[] = [];

  if (quantitiesByProduct.size === 0) {
    return warnings;
  }

  const resolvedWarehouseId = await resolveWarehouseId(
    companyId,
    saleWarehouseId,
    tx
  );

  const productIds = [...quantitiesByProduct.keys()];

  const products = await tx.product.findMany({
    where: {
      id: { in: productIds },
      companyId,
    },
  });

  for (const productId of productIds) {
    const product = products.find((entry) => entry.id === productId);

    if (!product) {
      throw new SaleStockValidationError("Satış kalemlerinden biri bulunamadı.");
    }

    if (isServiceProductType(product.productType)) {
      continue;
    }

    const requestedQty = quantitiesByProduct.get(productId) ?? 0;
    const { warehouse, quantity } = await getWarehouseStockQuantity(
      tx,
      companyId,
      productId,
      resolvedWarehouseId
    );

    if (quantity < requestedQty) {
      warnings.push({
        ...buildInsufficientStockWarning({
          productName: product.name,
          warehouseName: warehouse.name,
          availableQty: quantity,
          requestedQty,
        }),
        productId,
      });
    }
  }

  return warnings;
}

type StockItemInput = {
  productId?: string | null;
  quantity: number;
  warehouseId?: string | null;
};

export async function applySaleStockDecrement(
  tx: TransactionClient,
  companyId: string,
  saleNo: string,
  items: StockItemInput[],
  saleWarehouseId?: string | null
) {
  const stockItems = items.filter((item) => item.productId);

  if (stockItems.length === 0) {
    return;
  }

  const products = await tx.product.findMany({
    where: {
      companyId,
      id: {
        in: stockItems
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      },
    },
    select: { id: true, productType: true, name: true },
  });

  const stockProductIds = new Set(
    products
      .filter((product) => !isServiceProductType(product.productType))
      .map((product) => product.id)
  );

  const resolvedWarehouseId = await resolveWarehouseId(
    companyId,
    saleWarehouseId,
    tx
  );

  const warehouse = await tx.warehouse.findFirstOrThrow({
    where: { id: resolvedWarehouseId, companyId },
  });

  for (const item of items) {
    if (!item.productId || !stockProductIds.has(item.productId)) continue;

    const warehouseStock = await ensureProductWarehouseStock(
      companyId,
      item.productId,
      warehouse.id,
      tx
    );

    const product = products.find((entry) => entry.id === item.productId);

    const claim = await tx.warehouseStock.updateMany({
      where: {
        id: warehouseStock.id,
        companyId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
      },
    });

    if (claim.count === 0) {
      const named = await tx.product.findFirst({
        where: { id: item.productId, companyId },
        select: { name: true },
      });
      throw new SaleStockValidationError(
        `${named?.name ?? product?.name ?? "Ürün"} için yeterli stok bulunmuyor.`
      );
    }

    await tx.stockMovement.create({
      data: {
        companyId,
        productId: item.productId,
        warehouseId: warehouse.id,
        type: "SALE",
        quantity: -item.quantity,
        note: `${saleNo} numaralı satıştan stok düşüldü.`,
      },
    });

    await syncProductTotalStock(companyId, item.productId, tx);
  }
}
