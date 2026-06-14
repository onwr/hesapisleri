import type { MarketplaceChannelKey } from "@/lib/marketplace/marketplace-types";

export const CHANNEL_UI_CONFIG = {
  TRENDYOL: {
    title: "Trendyol",
    shortLabel: "T",
    description: "Sipariş senkronizasyonu ve operasyon yönetimi.",
    successTest: "Bağlantı başarılı. Trendyol API erişimi doğrulandı.",
    disconnectMessage: "Trendyol bağlantısı kesildi.",
    ordersHref: "/orders?channel=TRENDYOL",
    ordersLabel: "Siparişlere Git",
    mappingHref: "/products/channel-mapping?channel=TRENDYOL",
    supportsProductMappingImport: true,
    iconClass: "bg-gradient-to-br from-orange-500 to-amber-600 text-white",
    accentBorder: "border-orange-100",
    accentBg: "bg-orange-50/50",
  },
  HEPSIBURADA: {
    title: "Hepsiburada",
    shortLabel: "HB",
    description:
      "Hepsiburada siparişlerinizi panelinize aktarın, SKU eşlemesiyle stok operasyonuna bağlayın.",
    successTest: "Bağlantı başarılı. Hepsiburada API erişimi doğrulandı.",
    disconnectMessage: "Hepsiburada bağlantısı kesildi.",
    ordersHref: "/orders?channel=HEPSIBURADA",
    ordersLabel: "Siparişlere Git",
    mappingHref: "/products/channel-mapping?channel=HEPSIBURADA",
    supportsProductMappingImport: false,
    iconClass: "bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950",
    accentBorder: "border-amber-100",
    accentBg: "bg-amber-50/50",
  },
} as const satisfies Record<
  MarketplaceChannelKey,
  {
    title: string;
    shortLabel: string;
    description: string;
    successTest: string;
    disconnectMessage: string;
    ordersHref: string;
    ordersLabel: string;
    mappingHref: string;
    supportsProductMappingImport: boolean;
    iconClass: string;
    accentBorder: string;
    accentBg: string;
  }
>;

export function getStatusBadge(status?: string | null) {
  if (status === "CONNECTED") {
    return {
      label: "Bağlı",
      className: "bg-emerald-100 text-emerald-700",
    };
  }
  if (status === "ERROR") {
    return { label: "Hata", className: "bg-rose-100 text-rose-700" };
  }
  if (status === "DISABLED") {
    return { label: "Pasif", className: "bg-slate-100 text-slate-600" };
  }
  if (status === "DISCONNECTED") {
    return { label: "Bağlı değil", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Bağlı değil", className: "bg-amber-100 text-amber-700" };
}
