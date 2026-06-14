import { roundMoney } from "@/lib/sale-payment-utils";

export type PosQuickFilter = "all" | "in_stock" | "bestseller";

export type PosGridProduct = {
  id: string;
  name: string;
  stock: number;
  warehouseStock?: number;
  sellPrice: string | number;
  vatRate: number;
  imageUrl?: string | null;
  barcode?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
};

export function getPosProductStock(
  product: PosGridProduct,
  useWarehouseStock: boolean
) {
  if (useWarehouseStock && product.warehouseStock !== undefined) {
    return product.warehouseStock;
  }
  return product.stock;
}

export function isPosProductOutOfStock(
  product: PosGridProduct,
  useWarehouseStock: boolean
) {
  return getPosProductStock(product, useWarehouseStock) <= 0;
}

export function isPosProductLowStock(
  product: PosGridProduct,
  useWarehouseStock: boolean,
  threshold = 10
) {
  const stock = getPosProductStock(product, useWarehouseStock);
  return stock > 0 && stock <= threshold;
}

export function filterPosProducts(
  products: PosGridProduct[],
  input: {
    search?: string;
    categoryId?: string;
    quickFilter?: PosQuickFilter;
    useWarehouseStock?: boolean;
    limit?: number;
  }
) {
  const keyword = input.search?.trim().toLowerCase() ?? "";
  const useWarehouseStock = input.useWarehouseStock ?? false;
  let list = [...products];

  if (input.categoryId) {
    list = list.filter(
      (product) =>
        product.categoryId === input.categoryId ||
        product.category?.id === input.categoryId
    );
  }

  if (input.quickFilter === "in_stock") {
    list = list.filter(
      (product) => !isPosProductOutOfStock(product, useWarehouseStock)
    );
  }

  if (input.quickFilter === "bestseller") {
    list = list
      .filter((product) => !isPosProductOutOfStock(product, useWarehouseStock))
      .sort(
        (a, b) =>
          getPosProductStock(b, useWarehouseStock) -
          getPosProductStock(a, useWarehouseStock)
      );
  }

  if (keyword) {
    list = list.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product.barcode?.toLowerCase().includes(keyword) ||
        product.sku?.toLowerCase().includes(keyword) ||
        product.category?.name?.toLowerCase().includes(keyword)
    );
  }

  const limit = input.limit ?? 48;
  return list.slice(0, limit);
}

export function findPosProductByCode(
  products: PosGridProduct[],
  code: string
) {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;

  return (
    products.find(
      (product) =>
        product.barcode?.toLowerCase() === normalized ||
        product.sku?.toLowerCase() === normalized
    ) ?? null
  );
}

export function calculatePosChange(received: number, total: number) {
  if (!Number.isFinite(received) || received <= 0) return 0;
  return Math.max(0, roundMoney(received - total));
}

export function adjustCartQuantity(
  items: Array<{ productId: string; quantity: number; stock: number }>,
  productId: string,
  delta: number
) {
  return items
    .map((item) => {
      if (item.productId !== productId) return item;
      const nextQuantity = item.quantity + delta;
      if (nextQuantity > item.stock) return item;
      return { ...item, quantity: nextQuantity };
    })
    .filter((item) => item.quantity > 0);
}

export const POS_QUICK_FILTER_LABELS: Record<PosQuickFilter, string> = {
  all: "Tümü",
  in_stock: "Stokta olanlar",
  bestseller: "En çok satan",
};
