import type { MarketplaceChannel } from "@prisma/client";

export type ProductStockFilterKey = "all" | "in_stock" | "low_stock" | "out_of_stock";

export type ProductSortKey =
  | "recent"
  | "name"
  | "stock_asc"
  | "price_asc"
  | "price_desc";

export type ProductStockBadgeKey =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "negative_stock"
  | "service";

export const PRODUCT_STOCK_FILTER_LABELS: Record<ProductStockFilterKey, string> = {
  all: "Tümü",
  in_stock: "Stokta var",
  low_stock: "Düşük stok",
  out_of_stock: "Stok yok",
};

export const PRODUCT_SORT_LABELS: Record<ProductSortKey, string> = {
  recent: "Son eklenen",
  name: "Ada göre",
  stock_asc: "Stok azalan",
  price_asc: "Fiyat artan",
  price_desc: "Fiyat azalan",
};

export const MARKETPLACE_CHANNEL_LABELS: Record<MarketplaceChannel, string> = {
  TRENDYOL: "Trendyol",
  HEPSIBURADA: "Hepsiburada",
};

export const PRODUCT_FORM_SECTIONS = [
  "Temel Bilgiler",
  "Fiyat Bilgileri",
  "Stok & Barkod",
  "Durum",
] as const;

export function parseProductStockFilter(
  value?: string | null
): ProductStockFilterKey {
  if (
    value === "in_stock" ||
    value === "low_stock" ||
    value === "out_of_stock"
  ) {
    return value;
  }

  return "all";
}

export function parseProductSort(value?: string | null): ProductSortKey {
  if (
    value === "name" ||
    value === "stock_asc" ||
    value === "price_asc" ||
    value === "price_desc"
  ) {
    return value;
  }

  return "recent";
}

export function getProductTypeBadge(productType: "STOCK" | "SERVICE") {
  if (productType === "SERVICE") {
    return {
      label: "Hizmet",
      className: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    };
  }

  return {
    label: "Stoklu",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
}

export function getProductStockBadge(input: {
  stock: number;
  minStock: number;
  isService: boolean;
}): { key: ProductStockBadgeKey; label: string; className: string } {
  if (input.isService) {
    return {
      key: "service",
      label: "Hizmet",
      className: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    };
  }

  if (input.stock < 0) {
    return {
      key: "negative_stock",
      label: "Eksi Stok",
      className: "bg-rose-100 text-rose-800 ring-rose-200",
    };
  }

  if (input.stock <= 0) {
    return {
      key: "out_of_stock",
      label: "Stok yok",
      className: "bg-rose-50 text-rose-700 ring-rose-100",
    };
  }

  if (input.stock <= input.minStock) {
    return {
      key: "low_stock",
      label: "Düşük stok",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    };
  }

  return {
    key: "in_stock",
    label: "Stokta",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
}

export function isProductVisibleInPos(status: string) {
  return status === "ACTIVE";
}

export function getProductPosVisibilityBadge(status: string) {
  if (isProductVisibleInPos(status)) {
    return {
      label: "POS'ta gösteriliyor",
      className: "bg-blue-50 text-blue-700 ring-blue-100",
    };
  }

  return {
    label: "POS'ta gizli",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  };
}

export function getProductMarketplaceBadge(channels: MarketplaceChannel[]) {
  if (channels.length === 0) {
    return null;
  }

  const primary = channels[0];
  const label =
    channels.length === 1
      ? `${MARKETPLACE_CHANNEL_LABELS[primary]} eşli`
      : `${channels.length} kanal eşli`;

  return {
    label,
    className: "bg-violet-50 text-violet-700 ring-violet-100",
  };
}

export function matchesProductStockFilter(
  product: {
    stock: number;
    minStock: number;
    isService: boolean;
  },
  filter: ProductStockFilterKey
) {
  if (filter === "all") return true;

  if (product.isService) {
    return filter === "in_stock";
  }

  if (filter === "in_stock") {
    return product.stock > 0;
  }

  if (filter === "low_stock") {
    return product.stock <= product.minStock;
  }

  return product.stock <= 0;
}

export function sortProducts<T extends {
  name: string;
  stock: number;
  sellPrice: number;
  createdAt: Date;
}>(products: T[], sort: ProductSortKey): T[] {
  const copy = [...products];

  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
    case "stock_asc":
      return copy.sort((a, b) => a.stock - b.stock);
    case "price_asc":
      return copy.sort((a, b) => a.sellPrice - b.sellPrice);
    case "price_desc":
      return copy.sort((a, b) => b.sellPrice - a.sellPrice);
    default:
      return copy.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
  }
}

export {
  printProductBarcode,
  printProductBarcodesBulk,
  type BarcodePrintItem,
} from "@/lib/barcode-print-utils";
