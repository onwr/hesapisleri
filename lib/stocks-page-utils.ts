import {
  formatDateInputValue,
  parseDateParam,
  normalizeDateRange,
  formatDateDisplay,
} from "@/lib/sales-page-utils";
import { startOfDay } from "@/lib/dashboard-metrics";
import { formatMovementQuantityDisplay } from "@/lib/stock-movement-utils";

export type StockTabKey =
  | "all"
  | "low"
  | "out"
  | "movements"
  | "count"
  | "transfers"
  | "warehouses";

export type StockProductRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  categoryName: string;
  stock: number;
  criticalLevel: number;
  stockValue: number;
  sellPrice: number;
  statusLabel: string;
  statusBadgeClass: string;
  stockTextClass: string;
  detailHref: string;
  stockMovementHref: string;
  imageUrl: string | null;
};

export type StockMovementRow = {
  id: string;
  productId: string;
  productName: string;
  categoryName: string;
  type: string;
  quantity: number;
  note: string | null;
  warehouseName: string | null;
  createdAt: Date;
  detailHref: string;
};

export type StockTransferRow = {
  id: string;
  transferNo: string;
  productId: string;
  productName: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  quantity: number;
  status: string;
  note: string | null;
  createdAt: Date;
  canCancel: boolean;
};

export type StockWarehouseRow = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  isDefault: boolean;
  productCount: number;
  totalStock: number;
  totalValue: number;
  detailHref: string;
  editHref: string;
};

export type StockStatCard = {
  title: string;
  value: string;
  subtitle: string;
  iconKey: "package" | "boxes" | "warehouse" | "alert" | "alertRose";
  color: "blue" | "emerald" | "violet" | "orange" | "rose";
  tab: StockTabKey;
};

export type StockDistributionItem = {
  label: string;
  count: number;
  percent: number;
  color: string;
};

export type StockCategoryItem = {
  category: string;
  stock: number;
  badgeClass: string;
};

export type StockActionCard = {
  title: string;
  description: string;
  href?: string;
  iconKey: "in" | "out" | "count" | "transfer" | "plus";
  gradient: string;
  action?: "movement-in" | "movement-out" | "movement-count" | "transfer";
};

export const STOCK_TAB_LABELS: Record<StockTabKey, string> = {
  all: "Tüm Stoklar",
  low: "Düşük Stok",
  out: "Stokta Yok",
  movements: "Hareketler",
  count: "Sayım",
  transfers: "Transferler",
  warehouses: "Depolar",
};

/** minStock tanımsız ürünler için düşük stok eşiği */
export const DEFAULT_MIN_STOCK_FALLBACK = 10;

/** @deprecated DEFAULT_MIN_STOCK_FALLBACK kullanın */
export const CRITICAL_STOCK_LEVEL = DEFAULT_MIN_STOCK_FALLBACK;

export function resolveProductMinStock(minStock?: number | null) {
  if (typeof minStock === "number" && minStock >= 0) {
    return minStock;
  }

  return DEFAULT_MIN_STOCK_FALLBACK;
}

export function isLowStock(stock: number, minStock: number) {
  return stock > 0 && stock <= minStock;
}

export function isSufficientStock(stock: number, minStock: number) {
  return stock > minStock;
}

export const STOCK_CHART_COLORS = {
  sufficient: "#22c55e",
  low: "#f97316",
  out: "#ef4444",
  active: "#3b82f6",
};

export function parseStockTab(value?: string | null): StockTabKey {
  if (
    value === "low" ||
    value === "out" ||
    value === "movements" ||
    value === "count" ||
    value === "transfers" ||
    value === "warehouses"
  ) {
    return value;
  }

  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isMovementTab(tab: StockTabKey) {
  return tab === "movements" || tab === "count";
}

export function isTransferTab(tab: StockTabKey) {
  return tab === "transfers";
}

export function isWarehouseTab(tab: StockTabKey) {
  return tab === "warehouses";
}

export function isSpecialTab(tab: StockTabKey) {
  return isMovementTab(tab) || isTransferTab(tab) || isWarehouseTab(tab);
}

import {
  formatMoney as formatStockMoney,
  formatNumber as formatStockNumber,
} from "@/lib/format-utils";

export { formatStockMoney, formatStockNumber };

export function formatStockDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getMovementText(type: string) {
  if (type === "IN") return "Stok Girişi";
  if (type === "OUT") return "Stok Çıkışı";
  if (type === "ADJUSTMENT") return "Stok Düzeltme";
  if (type === "COUNT") return "Stok Sayımı";
  if (type === "SALE") return "Satış";
  if (type === "RETURN") return "İade";
  if (type === "TRANSFER_IN") return "Depo Girişi";
  if (type === "TRANSFER_OUT") return "Depo Çıkışı";
  return type;
}

export function getMovementClass(type: string) {
  if (type === "IN") return "bg-emerald-100 text-emerald-700";
  if (type === "RETURN") return "bg-emerald-100 text-emerald-700";
  if (type === "OUT") return "bg-rose-100 text-rose-700";
  if (type === "SALE") return "bg-rose-100 text-rose-700";
  if (type === "ADJUSTMENT") return "bg-orange-100 text-orange-700";
  if (type === "COUNT") return "bg-violet-100 text-violet-700";
  if (type === "TRANSFER_IN") return "bg-cyan-100 text-cyan-700";
  if (type === "TRANSFER_OUT") return "bg-indigo-100 text-indigo-700";
  return "bg-blue-100 text-blue-700";
}

export function getMovementSoftClass(type: string) {
  if (type === "IN") return "bg-emerald-50 text-emerald-600";
  if (type === "RETURN") return "bg-emerald-50 text-emerald-600";
  if (type === "OUT") return "bg-rose-50 text-rose-500";
  if (type === "SALE") return "bg-rose-50 text-rose-600";
  if (type === "ADJUSTMENT") return "bg-orange-50 text-orange-600";
  if (type === "COUNT") return "bg-violet-50 text-violet-600";
  if (type === "TRANSFER_IN") return "bg-cyan-50 text-cyan-600";
  if (type === "TRANSFER_OUT") return "bg-indigo-50 text-indigo-600";
  return "bg-blue-50 text-blue-600";
}

export function formatMovementQuantityForDisplay(type: string, quantity: number) {
  return formatMovementQuantityDisplay(type, quantity);
}

export function getStockStatus(stock: number, minStock = DEFAULT_MIN_STOCK_FALLBACK) {
  if (stock <= 0) {
    return {
      label: "Stokta Yok",
      badgeClass: "bg-rose-100 text-rose-700",
      textClass: "text-rose-500",
    };
  }

  if (isLowStock(stock, minStock)) {
    return {
      label: "Düşük Stok",
      badgeClass: "bg-orange-100 text-orange-700",
      textClass: "text-orange-500",
    };
  }

  return {
    label: "Yeterli",
    badgeClass: "bg-emerald-100 text-emerald-700",
    textClass: "text-emerald-600",
  };
}

export function getCategoryBadge(categoryName?: string | null) {
  const value = categoryName || "Genel";
  const normalized = value.toLocaleLowerCase("tr-TR");

  if (normalized.includes("bilgisayar")) return "bg-violet-50 text-violet-600";
  if (normalized.includes("telefon")) return "bg-blue-50 text-blue-600";
  if (normalized.includes("aksesuar")) return "bg-orange-50 text-orange-600";
  if (normalized.includes("yazıcı") || normalized.includes("yazici")) {
    return "bg-cyan-50 text-cyan-600";
  }
  if (normalized.includes("mobilya")) return "bg-rose-50 text-rose-600";

  return "bg-slate-100 text-slate-600";
}

export function isInDateRange(date: Date, from: Date, to: Date) {
  const value = date.getTime();
  return value >= startOfDay(from).getTime() && value <= endOfDay(to).getTime();
}

export function mapProductToStockRow(
  product: {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    stock: number;
    minStock?: number | null;
    sellPrice: unknown;
    imageUrl: string | null;
    category: { name: string } | null;
  },
  index: number
): StockProductRow {
  const criticalLevel = resolveProductMinStock(product.minStock);
  const stockStatus = getStockStatus(product.stock, criticalLevel);
  const categoryName = product.category?.name || "Genel";

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku || `STK-${String(index + 1).padStart(4, "0")}`,
    categoryName,
    stock: product.stock,
    criticalLevel,
    stockValue: product.stock * Number(product.sellPrice),
    sellPrice: Number(product.sellPrice),
    statusLabel: stockStatus.label,
    statusBadgeClass: stockStatus.badgeClass,
    stockTextClass: stockStatus.textClass,
    detailHref: `/products/${product.id}`,
    stockMovementHref: `/products/${product.id}/stock`,
    imageUrl: product.imageUrl,
  };
}

export function mapMovementToRow(movement: {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: Date;
  warehouse?: { name: string } | null;
  product: {
    id: string;
    name: string;
    category: { name: string } | null;
  };
}): StockMovementRow {
  return {
    id: movement.id,
    productId: movement.product.id,
    productName: movement.product.name,
    categoryName: movement.product.category?.name || "Genel",
    type: movement.type,
    quantity: movement.quantity,
    note: movement.note,
    warehouseName: movement.warehouse?.name ?? null,
    createdAt: movement.createdAt,
    detailHref: `/products/${movement.product.id}`,
  };
}

export function mapTransferToRow(transfer: {
  id: string;
  transferNo: string;
  quantity: number;
  status: string;
  note: string | null;
  createdAt: Date;
  product: { id: string; name: string };
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
}): StockTransferRow {
  return {
    id: transfer.id,
    transferNo: transfer.transferNo,
    productId: transfer.product.id,
    productName: transfer.product.name,
    fromWarehouseName: transfer.fromWarehouse.name,
    toWarehouseName: transfer.toWarehouse.name,
    quantity: transfer.quantity,
    status: transfer.status,
    note: transfer.note,
    createdAt: transfer.createdAt,
    canCancel: transfer.status === "COMPLETED",
  };
}

export function mapWarehouseToRow(
  warehouse: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    isDefault: boolean;
  },
  metrics: {
    productCount: number;
    totalStock: number;
    totalValue: number;
  }
): StockWarehouseRow {
  return {
    id: warehouse.id,
    name: warehouse.name,
    code: warehouse.code,
    status: warehouse.status,
    isDefault: warehouse.isDefault,
    productCount: metrics.productCount,
    totalStock: metrics.totalStock,
    totalValue: metrics.totalValue,
    detailHref: `/stocks/warehouses/${warehouse.id}`,
    editHref: `/stocks/warehouses/${warehouse.id}?edit=1`,
  };
}

export function filterProductsByTab(rows: StockProductRow[], tab: StockTabKey) {
  switch (tab) {
    case "low":
      return rows.filter((row) => isLowStock(row.stock, row.criticalLevel));
    case "out":
      return rows.filter((row) => row.stock <= 0);
    default:
      return rows;
  }
}

export function filterMovementsByTab(
  rows: StockMovementRow[],
  tab: StockTabKey
) {
  switch (tab) {
    case "count":
      return rows.filter((row) => row.type === "COUNT");
    case "movements":
      return rows;
    default:
      return rows;
  }
}

export function matchesProductSearch(row: StockProductRow, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    row.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.sku.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.categoryName.toLocaleLowerCase("tr-TR").includes(normalized)
  );
}

export function matchesMovementSearch(row: StockMovementRow, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    row.productName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    row.categoryName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    getMovementText(row.type).toLocaleLowerCase("tr-TR").includes(normalized) ||
    (row.note?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false)
  );
}

export function buildStockStatCards(stats: {
  totalProducts: number;
  activeProducts: number;
  totalStock: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}): StockStatCard[] {
  return [
    {
      title: "Toplam Ürün",
      value: formatStockNumber(stats.totalProducts),
      subtitle: `${stats.activeProducts} aktif ürün`,
      iconKey: "package",
      color: "blue",
      tab: "all",
    },
    {
      title: "Toplam Stok",
      value: formatStockNumber(stats.totalStock),
      subtitle: "Tüm ürün stok miktarı",
      iconKey: "boxes",
      color: "emerald",
      tab: "all",
    },
    {
      title: "Stok Değeri",
      value: formatStockMoney(stats.totalStockValue),
      subtitle: "Satış fiyatına göre",
      iconKey: "warehouse",
      color: "violet",
      tab: "all",
    },
    {
      title: "Düşük Stok",
      value: formatStockNumber(stats.lowStockCount),
      subtitle: "Ürün min. stok seviyesi ve altı",
      iconKey: "alert",
      color: "orange",
      tab: "low",
    },
    {
      title: "Stokta Yok",
      value: formatStockNumber(stats.outOfStockCount),
      subtitle: "Stok bekleyen ürün",
      iconKey: "alertRose",
      color: "rose",
      tab: "out",
    },
  ];
}

export function buildStockDistribution(
  products: StockProductRow[]
): StockDistributionItem[] {
  const sufficient = products.filter((p) =>
    isSufficientStock(p.stock, p.criticalLevel)
  ).length;
  const low = products.filter((p) => isLowStock(p.stock, p.criticalLevel)).length;
  const out = products.filter((p) => p.stock <= 0).length;
  const total = products.length;

  const items = [
    { label: "Yeterli", count: sufficient, color: STOCK_CHART_COLORS.sufficient },
    { label: "Düşük", count: low, color: STOCK_CHART_COLORS.low },
    { label: "Yok", count: out, color: STOCK_CHART_COLORS.out },
  ];

  return items.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0,
  }));
}

export function buildCategoryTotals(
  products: StockProductRow[]
): StockCategoryItem[] {
  const map = new Map<string, number>();

  for (const product of products) {
    map.set(product.categoryName, (map.get(product.categoryName) ?? 0) + product.stock);
  }

  return Array.from(map.entries())
    .map(([category, stock]) => ({
      category,
      stock,
      badgeClass: getCategoryBadge(category),
    }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);
}

export function buildStocksQuery(params: {
  tab?: StockTabKey;
  page?: number;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/stocks?${query}` : "/stocks";
}

export function buildStocksExportQuery(params: {
  tab?: StockTabKey;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/api/stocks/export?${query}` : "/api/stocks/export";
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
