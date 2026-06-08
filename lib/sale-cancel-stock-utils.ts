export type StockReturnEntry = {
  productId: string;
  warehouseId: string;
  quantity: number;
};

type SaleItemLike = {
  productId: string | null;
  warehouseId?: string | null;
  quantity: number;
};

type SaleMovementLike = {
  productId: string;
  warehouseId: string | null;
  quantity: number;
};

export function buildStockReturnEntries(
  items: SaleItemLike[],
  saleMovements: SaleMovementLike[],
  defaultWarehouseId: string
) {
  const itemsWithWarehouse = items.filter(
    (item) => item.productId && item.warehouseId
  );

  if (itemsWithWarehouse.length > 0) {
    const grouped = new Map<string, StockReturnEntry>();

    for (const item of itemsWithWarehouse) {
      if (!item.productId || !item.warehouseId) continue;

      const key = `${item.productId}:${item.warehouseId}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        grouped.set(key, {
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: item.quantity,
        });
      }
    }

    return [...grouped.values()];
  }

  if (saleMovements.length > 0) {
    const grouped = new Map<string, StockReturnEntry>();

    for (const movement of saleMovements) {
      const quantity = Math.abs(movement.quantity);
      if (quantity <= 0) continue;

      const warehouseId = movement.warehouseId ?? defaultWarehouseId;
      const key = `${movement.productId}:${warehouseId}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += quantity;
      } else {
        grouped.set(key, {
          productId: movement.productId,
          warehouseId,
          quantity,
        });
      }
    }

    return [...grouped.values()];
  }

  const grouped = new Map<string, StockReturnEntry>();

  for (const item of items) {
    if (!item.productId) continue;

    const key = `${item.productId}:${defaultWarehouseId}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      grouped.set(key, {
        productId: item.productId,
        warehouseId: defaultWarehouseId,
        quantity: item.quantity,
      });
    }
  }

  return [...grouped.values()];
}
