import type { ProductPageStats } from "@/lib/products-page-data";
import { formatProductMoney, formatProductNumber } from "@/lib/products-page-utils";

export type ProductQuickActionIconKey =
  | "plus"
  | "service"
  | "movement"
  | "warehouse"
  | "mapping"
  | "barcode";

export type ProductQuickActionCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  gradient: string;
  iconKey: ProductQuickActionIconKey;
  permission: "create" | "stocks" | "warehouses" | "products";
};

export type ProductSummaryCard = {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  iconKey: "items" | "stock" | "service" | "alert" | "value" | "active";
  color: "slate" | "emerald" | "blue" | "amber" | "violet" | "rose";
  tab?: string;
};

export type ProductPagePermissions = {
  canCreateProduct: boolean;
  canManageStocks: boolean;
  canManageWarehouses: boolean;
  canManageProducts: boolean;
};

export function buildProductQuickActionCards(): ProductQuickActionCard[] {
  return [
    {
      key: "new-product",
      title: "Yeni Ürün",
      description: "Stoklu ürün oluştur",
      href: "/products/new",
      gradient: "bg-linear-to-br from-emerald-500 to-green-600",
      iconKey: "plus",
      permission: "create",
    },
    {
      key: "new-service",
      title: "Yeni Hizmet",
      description: "Stoksuz hizmet kalemi oluştur",
      href: "/products/new?type=service",
      gradient: "bg-linear-to-br from-sky-400 to-cyan-600",
      iconKey: "service",
      permission: "create",
    },
    {
      key: "stock-movement",
      title: "Stok Hareketi",
      description: "Giriş, çıkış ve transfer işlemleri",
      href: "/products/stocks",
      gradient: "bg-linear-to-br from-orange-400 to-orange-600",
      iconKey: "movement",
      permission: "stocks",
    },
    {
      key: "warehouses",
      title: "Depolar",
      description: "Depo ve stok noktalarını yönet",
      href: "/products/stocks/warehouses",
      gradient: "bg-linear-to-br from-violet-500 to-purple-600",
      iconKey: "warehouse",
      permission: "warehouses",
    },
    {
      key: "channel-mapping",
      title: "SKU Eşlemeleri",
      description: "Pazaryeri ürün eşlemeleri",
      href: "/products/channel-mapping",
      gradient: "bg-linear-to-br from-rose-400 to-pink-600",
      iconKey: "mapping",
      permission: "products",
    },
    {
      key: "barcode",
      title: "Barkod İşlemleri",
      description: "Barkod yazdırma ve etiket işlemleri",
      href: "#products-list",
      gradient: "bg-linear-to-br from-indigo-500 to-blue-700",
      iconKey: "barcode",
      permission: "products",
    },
  ];
}

export function filterProductQuickActionCards(
  cards: ProductQuickActionCard[],
  permissions: ProductPagePermissions
): ProductQuickActionCard[] {
  return cards.filter((card) => {
    if (card.permission === "create") {
      return permissions.canCreateProduct;
    }
    if (card.permission === "stocks") {
      return permissions.canManageStocks;
    }
    if (card.permission === "warehouses") {
      return permissions.canManageWarehouses;
    }
    return permissions.canManageProducts;
  });
}

export function buildProductSummaryCards(stats: ProductPageStats): ProductSummaryCard[] {
  return [
    {
      key: "total-items",
      title: "Toplam Kalem",
      value: formatProductNumber(stats.totalProducts),
      subtitle: "Stoklu ürün + hizmet",
      iconKey: "items",
      color: "slate",
    },
    {
      key: "stock-products",
      title: "Stoklu Ürün",
      value: formatProductNumber(stats.stockProducts),
      subtitle: "Fiziksel ürünler",
      iconKey: "stock",
      color: "emerald",
      tab: "product",
    },
    {
      key: "service-products",
      title: "Hizmet",
      value: formatProductNumber(stats.serviceProducts),
      subtitle: "Stoksuz kalemler",
      iconKey: "service",
      color: "blue",
      tab: "service",
    },
    {
      key: "low-stock",
      title: "Düşük / Eksi Stok",
      value: formatProductNumber(stats.lowOrNegativeStock),
      subtitle: "Stoklu ürünlerde uyarı",
      iconKey: "alert",
      color: "amber",
      tab: "lowStock",
    },
    {
      key: "inventory-value",
      title: "Stok Değeri",
      value: formatProductMoney(stats.totalStockValue),
      subtitle: "Alış fiyatına göre",
      iconKey: "value",
      color: "violet",
    },
    {
      key: "active-products",
      title: "Aktif Ürün",
      value: formatProductNumber(stats.activeProducts),
      subtitle: "Satışa açık kalemler",
      iconKey: "active",
      color: "rose",
      tab: "active",
    },
  ];
}
