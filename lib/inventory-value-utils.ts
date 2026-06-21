import { isServiceProductType } from "@/lib/product-type-utils";

type ProductWithPurchasePrice = {
  productType?: "STOCK" | "SERVICE" | string | null;
  stock?: number | null;
  buyPrice?: unknown;
  purchasePrice?: unknown;
  [key: string]: unknown;
};

type WarehouseStockItem = {
  quantity: number;
  product: ProductWithPurchasePrice;
};

export function getProductPurchasePrice(product: ProductWithPurchasePrice): number {
  const raw = product.buyPrice ?? product.purchasePrice;

  if (raw === null || raw === undefined || raw === "") {
    return 0;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function calculateProductStockValue(product: ProductWithPurchasePrice): number {
  if (isServiceProductType(product.productType)) {
    return 0;
  }

  const stock = product.stock ?? 0;
  const purchasePrice = getProductPurchasePrice(product);

  return stock * purchasePrice;
}

export function calculateWarehouseStockValue(items: WarehouseStockItem[]): number {
  return items.reduce((sum, item) => {
    if (isServiceProductType(item.product.productType)) {
      return sum;
    }

    return sum + item.quantity * getProductPurchasePrice(item.product);
  }, 0);
}

export function calculateInventoryValue(
  products: ProductWithPurchasePrice[]
): number {
  return products.reduce(
    (sum, product) => sum + calculateProductStockValue(product),
    0
  );
}
