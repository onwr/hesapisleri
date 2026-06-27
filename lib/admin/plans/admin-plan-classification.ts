import type { MembershipPeriod, PlanPriceStatus } from "@prisma/client";

export type PlanPricingClass = "FREE" | "PAID" | "MIXED" | "UNCONFIGURED";

export type PurchasablePrice = {
  billingInterval: MembershipPeriod;
  currency: string;
  salePriceMinor: number;
  status: PlanPriceStatus;
  isPublic: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

function isPurchasableEffective(price: PurchasablePrice, now: Date): boolean {
  if (!price.isPublic) return false;
  if (!["ACTIVE", "SCHEDULED"].includes(price.status)) return false;
  if (price.status === "ACTIVE") {
    if (price.effectiveFrom > now) return false;
    if (price.effectiveUntil && price.effectiveUntil <= now) return false;
    return true;
  }
  if (price.status === "SCHEDULED" && price.effectiveFrom <= now) {
    if (price.effectiveUntil && price.effectiveUntil <= now) return false;
    return true;
  }
  return false;
}

export function classifyPlanPricing(
  prices: PurchasablePrice[],
  now = new Date()
): PlanPricingClass {
  const purchasable = prices.filter((p) => isPurchasableEffective(p, now));
  if (purchasable.length === 0) return "UNCONFIGURED";

  const hasFree = purchasable.some((p) => p.salePriceMinor === 0);
  const hasPaid = purchasable.some((p) => p.salePriceMinor > 0);

  if (hasFree && hasPaid) return "MIXED";
  if (hasPaid) return "PAID";
  if (hasFree) return "FREE";
  return "UNCONFIGURED";
}

export function getPlanPricingClassLabel(cls: PlanPricingClass): string {
  switch (cls) {
    case "FREE":
      return "Ücretsiz";
    case "PAID":
      return "Ücretli";
    case "MIXED":
      return "Karma (ücretsiz + ücretli)";
    case "UNCONFIGURED":
      return "Fiyat yapılandırılmamış";
  }
}
