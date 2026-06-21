import type { ProductType } from "@prisma/client";

export const PRODUCT_TYPES = ["STOCK", "SERVICE"] as const;

export type ProductTypeKey = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Record<ProductTypeKey, string> = {
  STOCK: "Stoklu Ürün",
  SERVICE: "Hizmet",
};

export const PRODUCT_TYPE_SHORT_LABELS: Record<ProductTypeKey, string> = {
  STOCK: "Stoklu",
  SERVICE: "Hizmet",
};

export const PRODUCT_TYPE_DESCRIPTIONS: Record<ProductTypeKey, string> = {
  STOCK:
    "Fiziksel ürünler için stok, depo ve barkod takibi yapılır.",
  SERVICE:
    "Danışmanlık, işçilik, kargo, montaj gibi stoksuz satış kalemleri için kullanılır.",
};

export function parseProductType(value?: string | null): ProductTypeKey {
  if (value === "SERVICE" || value === "service") {
    return "SERVICE";
  }

  return "STOCK";
}

export function parseProductTypeFilter(
  value?: string | null
): "all" | ProductTypeKey {
  if (value === "stock" || value === "STOCK") return "STOCK";
  if (value === "service" || value === "SERVICE") return "SERVICE";
  return "all";
}

export function isServiceProductType(
  productType?: ProductType | ProductTypeKey | string | null
) {
  return productType === "SERVICE";
}

export function isStockProductType(
  productType?: ProductType | ProductTypeKey | string | null
) {
  return !productType || productType === "STOCK";
}

export function isServiceProduct(product: {
  productType?: ProductType | ProductTypeKey | string | null;
}) {
  return isServiceProductType(product.productType);
}

export function buildProductTypePrismaFilter(type: "all" | ProductTypeKey) {
  if (type === "all") {
    return {};
  }

  return { productType: type };
}

export function normalizeServiceProductFields<T extends {
  productType?: ProductTypeKey;
  stock?: number;
  minStock?: number;
  barcode?: string | null;
  warehouseLocation?: string | null;
}>(data: T) {
  if (data.productType !== "SERVICE") {
    return data;
  }

  return {
    ...data,
    stock: 0,
    minStock: 0,
    barcode: null,
    warehouseLocation: null,
  };
}

export function getProductStockDisplayLabel(input: {
  productType?: ProductType | ProductTypeKey | string | null;
  stock?: number;
}) {
  if (isServiceProductType(input.productType)) {
    return "Stoksuz";
  }

  return String(input.stock ?? 0);
}
