export type MarketingIntegrationStatus = "active" | "coming_soon";

export type MarketplaceIntegration = {
  key: string;
  name: string;
  logoSrc: string;
  logoWidth: number;
  logoHeight: number;
  status: MarketingIntegrationStatus;
};

export type BuiltinIntegration = {
  key: string;
  name: string;
  description: string;
  tag: "Dahili" | "Ödeme" | "Yakında";
  status: MarketingIntegrationStatus;
};

/** Pazaryeri sync adaptörleri: lib/marketplace/marketplace-types.ts */
export const MARKETING_MARKETPLACE_INTEGRATIONS: MarketplaceIntegration[] = [
  {
    key: "TRENDYOL",
    name: "Trendyol",
    logoSrc: "/trendyol.jpg",
    logoWidth: 140,
    logoHeight: 48,
    status: "active",
  },
  {
    key: "HEPSIBURADA",
    name: "Hepsiburada",
    logoSrc: "/hepsiburada.png",
    logoWidth: 160,
    logoHeight: 48,
    status: "active",
  },
  {
    key: "N11",
    name: "N11",
    logoSrc: "/n11.png",
    logoWidth: 90,
    logoHeight: 48,
    status: "coming_soon",
  },
  {
    key: "CICEKSEPETI",
    name: "ÇiçekSepeti",
    logoSrc: "/ciceksepeti.png",
    logoWidth: 150,
    logoHeight: 48,
    status: "coming_soon",
  },
];

export const MARKETING_BUILTIN_INTEGRATIONS: BuiltinIntegration[] = [
  {
    key: "e-invoice",
    name: "e-Fatura / e-Arşiv",
    description: "Elektronik fatura ve arşiv belgeleri",
    tag: "Dahili",
    status: "active",
  },
  {
    key: "paytr",
    name: "PayTR",
    description: "Online ödeme altyapısı",
    tag: "Ödeme",
    status: "active",
  },
];

export const ACTIVE_MARKETPLACE_KEYS = MARKETING_MARKETPLACE_INTEGRATIONS.filter(
  (item) => item.status === "active"
).map((item) => item.key);
