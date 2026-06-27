import type { MembershipPeriod } from "@prisma/client";

type PriceLike = {
  billingInterval: MembershipPeriod;
  currency: string;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

function isEffectivePrice(price: PriceLike, now: Date): boolean {
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

export function findEffectivePricesAt<T extends PriceLike>(
  prices: T[],
  billingInterval: MembershipPeriod,
  currency: string,
  now = new Date()
): T[] {
  return prices.filter(
    (p) =>
      p.billingInterval === billingInterval &&
      p.currency === currency &&
      isEffectivePrice(p, now)
  );
}

export function findPriceResolutionConflicts<T extends PriceLike>(
  prices: T[],
  now = new Date()
): MembershipPeriod[] {
  const intervals: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];
  const conflicts: MembershipPeriod[] = [];
  const keys = new Set<string>();
  for (const p of prices) {
    keys.add(`${p.billingInterval}|${p.currency}`);
  }
  for (const key of keys) {
    const [interval, currency] = key.split("|") as [MembershipPeriod, string];
    const effective = findEffectivePricesAt(prices, interval, currency, now);
    if (effective.length > 1) {
      conflicts.push(interval);
    }
  }
  return [...new Set(conflicts)];
}

export class PriceResolutionConflictError extends Error {
  status = 409;
  intervals: MembershipPeriod[];
  constructor(intervals: MembershipPeriod[]) {
    super("PRICE_RESOLUTION_CONFLICT");
    this.name = "PriceResolutionConflictError";
    this.intervals = intervals;
  }
}

export function assertSingleEffectivePrice<T extends PriceLike>(
  prices: T[],
  billingInterval: MembershipPeriod,
  currency: string,
  now = new Date()
): T | null {
  const effective = findEffectivePricesAt(prices, billingInterval, currency, now);
  if (effective.length > 1) {
    throw new PriceResolutionConflictError([billingInterval]);
  }
  return effective[0] ?? null;
}
