import type { MarketplaceChannel } from "@prisma/client";

export function parseMarketplaceChannel(value: string): MarketplaceChannel | null {
  if (value === "TRENDYOL" || value === "HEPSIBURADA") {
    return value;
  }
  return null;
}
