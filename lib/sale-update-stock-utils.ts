import { db } from "@/lib/prisma";
import {
  buildInsufficientStockWarning,
  type StockWarningItem,
} from "@/lib/stock-policy";
import { isServiceProductType } from "@/lib/product-type-utils";
import {
  ensureProductWarehouseStock,
  getWarehouseStockQuantity,
  syncProductTotalStock,
} from "@/lib/warehouse-service";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type SaleStockLine = {
  productId: string | null;
  warehouseId?: string | null;
  quantity: number;
};

export type SaleStockCorrectionDelta = {
  productId: string;
  warehouseId: string;
  delta: number;
};

function stockKey(productId: string, warehouseId: string) {
  return `${productId}:${warehouseId}`;
}

export function buildSaleStockCorrectionDeltas(
  oldItems: SaleStockLine[],
  newItems: SaleStockLine[],
  defaultWarehouseId: string
): SaleStockCorrectionDelta[] {
  const oldMap = new Map<string, number>();
  const newMap = new Map<string, number>();

  for (const item of oldItems) {
    if (!item.productId) continue;
    const warehouseId = item.warehouseId ?? defaultWarehouseId;
    const key = stockKey(item.productId, warehouseId);
    oldMap.set(key, (oldMap.get(key) ?? 0) + item.quantity);
  }

  for (const item of newItems) {
    if (!item.productId) continue;
    const warehouseId = item.warehouseId ?? defaultWarehouseId;
    const key = stockKey(item.productId, warehouseId);
    newMap.set(key, (newMap.get(key) ?? 0) + item.quantity);
  }

  const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const deltas: SaleStockCorrectionDelta[] = [];

  for (const key of keys) {
    const [productId, warehouseId] = key.split(":");
    const delta = (newMap.get(key) ?? 0) - (oldMap.get(key) ?? 0);
    if (delta === 0) continue;
    deltas.push({ productId, warehouseId, delta });
  }

  return deltas;
}

export async function validateSaleStockCorrectionDeltas(
  tx: TransactionClient,
  companyId: string,
  deltas: SaleStockCorrectionDelta[]
): Promise<StockWarningItem[]> {
  const warnings: StockWarningItem[] = [];

  for (const delta of deltas) {
    if (delta.delta <= 0) continue;

    const product = await tx.product.findFirst({
      where: { id: delta.productId, companyId },
    });

    if (!product) {
      throw new Error("Satış kalemlerinden biri bulunamadı.");
    }

    if (isServiceProductType(product.productType)) {
      continue;
    }

    const { warehouse, quantity } = await getWarehouseStockQuantity(
      tx,
      companyId,
      delta.productId,
      delta.warehouseId
    );

    if (quantity < delta.delta) {
      warnings.push({
        ...buildInsufficientStockWarning({
          productName: product.name,
          warehouseName: warehouse.name,
          availableQty: quantity,
          requestedQty: delta.delta,
        }),
        productId: delta.productId,
      });
    }
  }

  return warnings;
}

export async function applySaleStockCorrectionDeltas(
  tx: TransactionClient,
  companyId: string,
  saleNo: string,
  deltas: SaleStockCorrectionDelta[]
) {
  for (const delta of deltas) {
    if (delta.delta === 0) continue;

    const warehouseStock = await ensureProductWarehouseStock(
      companyId,
      delta.productId,
      delta.warehouseId,
      tx
    );

    if (delta.delta > 0) {
      await tx.warehouseStock.update({
        where: { id: warehouseStock.id },
        data: {
          quantity: warehouseStock.quantity - delta.delta,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId: delta.productId,
          warehouseId: delta.warehouseId,
          type: "SALE",
          quantity: -delta.delta,
          note: `${saleNo} numaralı satış düzeltmesi: ek stok çıkışı (+${delta.delta}).`,
        },
      });
    } else {
      const returnQty = Math.abs(delta.delta);

      await tx.warehouseStock.update({
        where: { id: warehouseStock.id },
        data: {
          quantity: warehouseStock.quantity + returnQty,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId,
          productId: delta.productId,
          warehouseId: delta.warehouseId,
          type: "RETURN",
          quantity: returnQty,
          note: `${saleNo} numaralı satış düzeltmesi: stok iadesi (${returnQty}).`,
        },
      });
    }

    await syncProductTotalStock(companyId, delta.productId, tx);
  }
}
