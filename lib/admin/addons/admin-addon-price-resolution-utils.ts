import type { MembershipPeriod } from "@prisma/client";

type PriceLike = {
  billingInterval: MembershipPeriod | null;
  currency: string;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
};

function isEffectivePrice(price: PriceLike, now: Date): boolean {
  if (price.status !== "ACTIVE") return false;
  if (price.effectiveFrom > now) return false;
  if (price.effectiveUntil && price.effectiveUntil <= now) return false;
  return true;
}

export function findEffectiveAddOnPricesAt<T extends PriceLike>(
  prices: T[],
  billingInterval: MembershipPeriod | null | undefined,
  currency: string,
  now = new Date()
): T[] {
  const interval = billingInterval ?? null;
  return prices.filter(
    (p) =>
      (p.billingInterval ?? null) === interval &&
      p.currency === currency &&
      isEffectivePrice(p, now)
  );
}

export function findAddOnPriceResolutionConflicts<T extends PriceLike>(
  prices: T[],
  now = new Date()
): string[] {
  const conflicts: string[] = [];
  const keys = new Set<string>();
  for (const p of prices) {
    keys.add(`${p.billingInterval ?? "ONE_TIME"}|${p.currency}`);
  }
  for (const key of keys) {
    const [intervalRaw, currency] = key.split("|");
    const interval =
      intervalRaw === "ONE_TIME"
        ? null
        : (intervalRaw as MembershipPeriod);
    const effective = findEffectiveAddOnPricesAt(prices, interval, currency, now);
    if (effective.length > 1) conflicts.push(key);
  }
  return conflicts;
}

export function assertSingleEffectiveAddOnPrice<T extends PriceLike>(
  prices: T[],
  billingInterval: MembershipPeriod | null | undefined,
  currency: string,
  now = new Date()
): T | null {
  const effective = findEffectiveAddOnPricesAt(prices, billingInterval, currency, now);
  if (effective.length > 1) {
    throw new Error("PRICE_RESOLUTION_CONFLICT");
  }
  return effective[0] ?? null;
}
