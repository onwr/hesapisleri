import { db } from "@/lib/prisma";
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
) {
  const quantitiesByProduct = aggregateQuantitiesByProduct(items);

  if (quantitiesByProduct.size === 0) {
    return;
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

    const requestedQty = quantitiesByProduct.get(productId) ?? 0;
    const { warehouse, quantity } = await getWarehouseStockQuantity(
      tx,
      companyId,
      productId,
      resolvedWarehouseId
    );

    if (quantity < requestedQty) {
      throw new SaleStockValidationError(
        `${warehouse.name} deposunda ${product.name} için yeterli stok yok. Mevcut: ${quantity}`
      );
    }
  }
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
  const resolvedWarehouseId = await resolveWarehouseId(
    companyId,
    saleWarehouseId,
    tx
  );

  const warehouse = await tx.warehouse.findFirstOrThrow({
    where: { id: resolvedWarehouseId, companyId },
  });

  for (const item of items) {
    if (!item.productId) continue;

    const warehouseStock = await ensureProductWarehouseStock(
      companyId,
      item.productId,
      warehouse.id,
      tx
    );

    if (warehouseStock.quantity < item.quantity) {
      throw new SaleStockValidationError(
        `${warehouse.name} deposunda yeterli stok yok. Mevcut: ${warehouseStock.quantity}`
      );
    }

    await tx.warehouseStock.update({
      where: { id: warehouseStock.id },
      data: {
        quantity: warehouseStock.quantity - item.quantity,
      },
    });

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
