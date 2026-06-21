import { formatMoney, formatNumber } from "@/lib/format-utils";

export type WarehousePageStats = {
  totalWarehouses: number;
  activeWarehouses: number;
  totalProductVariety: number;
  totalStock: number;
  totalStockValue: number;
  lowStockCount: number;
};

export type WarehouseQuickActionKey =
  | "create"
  | "transfer"
  | "movement"
  | "lowStock";

export type WarehouseQuickActionCard = {
  key: WarehouseQuickActionKey;
  title: string;
  description: string;
  gradient: string;
  iconKey: "plus" | "transfer" | "movement" | "alert";
};

export type WarehouseSummaryCard = {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  iconKey: "warehouse" | "active" | "products" | "stock" | "value" | "alert";
  color: "slate" | "emerald" | "blue" | "amber" | "violet" | "rose";
};

export function buildWarehouseQuickActionCards(): WarehouseQuickActionCard[] {
  return [
    {
      key: "create",
      title: "Yeni Depo",
      description: "Yeni stok noktası oluştur",
      gradient: "bg-linear-to-br from-emerald-500 to-green-600",
      iconKey: "plus",
    },
    {
      key: "transfer",
      title: "Depolar Arası Transfer",
      description: "Ürünleri depolar arasında taşı",
      gradient: "bg-linear-to-br from-violet-500 to-purple-600",
      iconKey: "transfer",
    },
    {
      key: "movement",
      title: "Stok Hareketi",
      description: "Giriş, çıkış ve sayım işlemleri",
      gradient: "bg-linear-to-br from-orange-400 to-orange-600",
      iconKey: "movement",
    },
    {
      key: "lowStock",
      title: "Düşük Stoklar",
      description: "Kritik seviyedeki ürünleri incele",
      gradient: "bg-linear-to-br from-rose-400 to-pink-600",
      iconKey: "alert",
    },
  ];
}

export function buildWarehouseSummaryCards(
  stats: WarehousePageStats
): WarehouseSummaryCard[] {
  return [
    {
      key: "total-warehouses",
      title: "Toplam Depo",
      value: formatNumber(stats.totalWarehouses),
      subtitle: "Kayıtlı depo sayısı",
      iconKey: "warehouse",
      color: "slate",
    },
    {
      key: "active-warehouses",
      title: "Aktif Depo",
      value: formatNumber(stats.activeWarehouses),
      subtitle: "Kullanımda olan depolar",
      iconKey: "active",
      color: "emerald",
    },
    {
      key: "product-variety",
      title: "Toplam Ürün Çeşidi",
      value: formatNumber(stats.totalProductVariety),
      subtitle: "Depolarda bulunan ürün",
      iconKey: "products",
      color: "blue",
    },
    {
      key: "total-stock",
      title: "Toplam Stok",
      value: formatNumber(stats.totalStock),
      subtitle: "Tüm depolardaki miktar",
      iconKey: "stock",
      color: "violet",
    },
    {
      key: "stock-value",
      title: "Stok Değeri",
      value: formatMoney(stats.totalStockValue),
      subtitle: "Alış fiyatına göre toplam",
      iconKey: "value",
      color: "amber",
    },
    {
      key: "low-stock",
      title: "Düşük Stok",
      value: formatNumber(stats.lowStockCount),
      subtitle: "Kritik seviyedeki ürün",
      iconKey: "alert",
      color: "rose",
    },
  ];
}
