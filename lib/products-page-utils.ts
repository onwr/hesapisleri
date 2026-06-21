export type ProductTabKey =
  | "all"
  | "active"
  | "passive"
  | "service"
  | "product"
  | "lowStock";

export type ProductTableRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  categoryName: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  sellPrice: number;
  status: string;
  imageUrl: string | null;
  isService: boolean;
  productType: "STOCK" | "SERVICE";
  mappedChannels: Array<"TRENDYOL" | "HEPSIBURADA">;
};

export type ProductRowActionData = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  status: string;
  isService: boolean;
  exportHref: string;
  sellPriceLabel?: string;
};

export type ProductStatCard = {
  title: string;
  value: string;
  subtitle: string;
  secondSubtitle?: string;
  iconKey: "package" | "boxes" | "alert" | "wallet" | "spreadsheet";
  color: "emerald" | "blue" | "orange" | "violet";
};

export const PRODUCT_TAB_LABELS: Record<ProductTabKey, string> = {
  all: "Tümü",
  active: "Aktif",
  passive: "Pasif",
  service: "Hizmet",
  product: "Ürün",
  lowStock: "Düşük Stok",
};

export const LOW_STOCK_THRESHOLD = 10;

export function parseProductTab(value?: string | null): ProductTabKey {
  if (
    value === "active" ||
    value === "passive" ||
    value === "service" ||
    value === "product" ||
    value === "lowStock"
  ) {
    return value;
  }

  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseCategoryFilter(value?: string | null) {
  if (!value || value === "all") return null;
  return decodeURIComponent(value);
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isServiceProduct(product: {
  productType?: string | null;
  name?: string;
  description?: string | null;
  categoryName?: string | null;
}) {
  if (product.productType) {
    return product.productType === "SERVICE";
  }

  const haystack = [product.name, product.description, product.categoryName]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  return haystack.includes("hizmet");
}

export function buildProductsQuery(params: {
  tab?: ProductTabKey;
  page?: number;
  category?: string | null;
  q?: string | null;
  stock?: string | null;
  sort?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.stock) {
    search.set("stock", params.stock);
  }

  if (params.sort) {
    search.set("sort", params.sort);
  }

  const query = search.toString();
  return query ? `/products?${query}` : "/products";
}

export function buildProductsExportQuery(params: {
  tab?: ProductTabKey;
  category?: string | null;
  q?: string | null;
  stock?: string | null;
  sort?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.category) {
    search.set("category", params.category);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.stock) {
    search.set("stock", params.stock);
  }

  if (params.sort) {
    search.set("sort", params.sort);
  }

  const query = search.toString();
  return query ? `/api/products/export?${query}` : "/api/products/export";
}

export {
  formatMoney as formatProductMoney,
  formatNumber as formatProductNumber,
} from "@/lib/format-utils";

export function getStockLevelStyle(stock: number) {
  if (stock < 0) {
    return "text-rose-700";
  }

  if (stock <= 0) {
    return "text-rose-500";
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return "text-orange-500";
  }

  return "text-emerald-600";
}

export function getCategoryBadge(categoryName?: string | null) {
  const value = categoryName || "Genel";
  const normalized = value.toLocaleLowerCase("tr-TR");

  if (normalized.includes("bilgisayar")) {
    return "bg-violet-50 text-violet-600";
  }

  if (normalized.includes("telefon")) {
    return "bg-blue-50 text-blue-600";
  }

  if (normalized.includes("aksesuar")) {
    return "bg-orange-50 text-orange-600";
  }

  if (normalized.includes("yazıcı") || normalized.includes("yazici")) {
    return "bg-cyan-50 text-cyan-600";
  }

  if (normalized.includes("mobilya")) {
    return "bg-rose-50 text-rose-600";
  }

  if (normalized.includes("hizmet")) {
    return "bg-indigo-50 text-indigo-600";
  }

  return "bg-slate-100 text-slate-600";
}

export function getProductStatusBadge(status: string) {
  if (status === "ACTIVE") {
    return {
      label: "Aktif",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "SUSPENDED") {
    return {
      label: "Askıda",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Pasif",
    className: "bg-slate-100 text-slate-600",
  };
}

const STOCK_MOVEMENT_LABELS: Record<string, string> = {
  IN: "Stok Girişi",
  OUT: "Stok Çıkışı",
  SALE: "Satış",
  RETURN: "İade",
  ADJUSTMENT: "Stok Düzeltme",
  COUNT: "Stok Sayımı",
  TRANSFER_IN: "Depo Girişi",
  TRANSFER_OUT: "Depo Çıkışı",
};

export function getStockMovementTypeLabel(type: string) {
  return STOCK_MOVEMENT_LABELS[type] ?? type;
}
