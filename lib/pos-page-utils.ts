import { roundMoney } from "@/lib/sale-payment-utils";
import { isNegativeStock, isZeroOrNegativeStock } from "@/lib/stock-policy";

export type PosQuickFilter = "all" | "stock" | "service" | "low_stock";

export type PosGridProduct = {
  id: string;
  name: string;
  stock: number;
  productType?: "STOCK" | "SERVICE";
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

export function isPosProductNegativeStock(
  product: PosGridProduct,
  useWarehouseStock: boolean
) {
  return isNegativeStock(getPosProductStock(product, useWarehouseStock));
}

export function isPosProductLowStock(
  product: PosGridProduct,
  useWarehouseStock: boolean,
  threshold = 10
) {
  const stock = getPosProductStock(product, useWarehouseStock);
  return !isNegativeStock(stock) && stock > 0 && stock <= threshold;
}

export function getPosStockBadge(
  stock: number,
  productType?: "STOCK" | "SERVICE"
): { label: string; className: string } {
  if (productType === "SERVICE") {
    return {
      label: "Hizmet",
      className: "bg-indigo-50 text-indigo-700",
    };
  }

  if (isNegativeStock(stock)) {
    return {
      label: "Eksi stok",
      className: "bg-rose-100 text-rose-800",
    };
  }

  if (isZeroOrNegativeStock(stock)) {
    return {
      label: "Stok düşük",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (stock <= 10) {
    return {
      label: `${stock} stok`,
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: `${stock} stok`,
    className: "bg-emerald-50 text-emerald-700",
  };
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

  if (input.quickFilter === "stock") {
    list = list.filter((product) => product.productType !== "SERVICE");
  }

  if (input.quickFilter === "service") {
    list = list.filter((product) => product.productType === "SERVICE");
  }

  if (input.quickFilter === "low_stock") {
    list = list.filter(
      (product) =>
        product.productType !== "SERVICE" &&
        (isPosProductLowStock(product, useWarehouseStock) ||
          isPosProductOutOfStock(product, useWarehouseStock) ||
          isPosProductNegativeStock(product, useWarehouseStock))
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

export function adjustCartQuantity<
  T extends { productId: string; quantity: number },
>(items: T[], productId: string, delta: number): T[] {
  return items
    .map((item) => {
      if (item.productId !== productId) return item;
      const nextQuantity = item.quantity + delta;
      return { ...item, quantity: nextQuantity };
    })
    .filter((item) => item.quantity > 0);
}

export function setCartItemQuantity<
  T extends { productId: string; quantity: number },
>(items: T[], productId: string, quantity: number): T[] {
  if (quantity <= 0) {
    return items.filter((item) => item.productId !== productId);
  }

  return items.map((item) =>
    item.productId === productId ? { ...item, quantity } : item
  );
}

export const POS_QUICK_FILTER_LABELS: Record<PosQuickFilter, string> = {
  all: "Tümü",
  stock: "Stoklu Ürünler",
  service: "Hizmetler",
  low_stock: "Düşük Stok",
};
