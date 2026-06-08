import type { OrderSourceChannel } from "@prisma/client";
import {
  getSourceChannelLabel,
  isMarketplaceChannel,
  MARKETPLACE_CHANNELS,
} from "@/lib/order-utils";

export type MarketplaceIntegration = {
  key: OrderSourceChannel;
  name: string;
  logo: string;
  color: string;
};

export const MARKETPLACE_INTEGRATIONS: MarketplaceIntegration[] = [
  {
    key: "TRENDYOL",
    name: "Trendyol",
    logo: "/trendyol.jpg",
    color: "#f97316",
  },
  {
    key: "HEPSIBURADA",
    name: "Hepsiburada",
    logo: "/hepsiburada.png",
    color: "#7c3aed",
  },
  {
    key: "N11",
    name: "N11",
    logo: "/n11.png",
    color: "#ef4444",
  },
  {
    key: "CICEKSEPETI",
    name: "ÇiçekSepeti",
    logo: "/ciceksepeti.png",
    color: "#22c55e",
  },
  {
    key: "AMAZON",
    name: "Amazon",
    logo: "",
    color: "#f59e0b",
  },
  {
    key: "ETSY",
    name: "Etsy",
    logo: "",
    color: "#f97316",
  },
];

const CHANNEL_COLORS: Partial<Record<OrderSourceChannel, string>> = {
  MANUAL: "#64748b",
  POS: "#0ea5e9",
  WEBSITE: "#6366f1",
  OTHER: "#94a3b8",
};

export function getMarketplaceLogo(key: OrderSourceChannel | string) {
  const integration = MARKETPLACE_INTEGRATIONS.find((item) => item.key === key);
  return integration?.logo || null;
}

export function getMarketplaceName(key: OrderSourceChannel | string) {
  const integration = MARKETPLACE_INTEGRATIONS.find((item) => item.key === key);
  if (integration) return integration.name;
  return getSourceChannelLabel(key as OrderSourceChannel);
}

export function getChannelColor(key: OrderSourceChannel) {
  const integration = MARKETPLACE_INTEGRATIONS.find((item) => item.key === key);
  return integration?.color ?? CHANNEL_COLORS[key] ?? "#64748b";
}

export { isMarketplaceChannel, MARKETPLACE_CHANNELS };
