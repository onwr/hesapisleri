import type { MembershipPeriod } from "@prisma/client";

export const CANONICAL_BILLING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
] as const satisfies readonly MembershipPeriod[];

export type CanonicalBillingPeriod = (typeof CANONICAL_BILLING_PERIODS)[number];

const INTERVAL_MONTHS_TO_PERIOD: Record<number, MembershipPeriod> = {
  1: "MONTHLY",
  3: "QUARTERLY",
  6: "SEMI_ANNUAL",
  12: "YEARLY",
};

export function normalizeBillingPeriodInput(
  raw: unknown
): MembershipPeriod | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().toUpperCase().replace(/-/g, "_");
  if ((CANONICAL_BILLING_PERIODS as readonly string[]).includes(normalized)) {
    return normalized as MembershipPeriod;
  }

  switch (normalized) {
    case "MONTH":
    case "1":
    case "1_MONTH":
    case "1_MONTHS":
      return "MONTHLY";
    case "THREE_MONTHS":
    case "3":
    case "3_MONTH":
    case "3_MONTHS":
      return "QUARTERLY";
    case "SEMIANNUAL":
    case "SIX_MONTHS":
    case "6":
    case "6_MONTH":
    case "6_MONTHS":
      return "SEMI_ANNUAL";
    case "ANNUAL":
    case "YEAR":
    case "12":
    case "12_MONTH":
    case "12_MONTHS":
      return "YEARLY";
    default:
      return null;
  }
}

export function resolveCanonicalBillingPeriod(input: {
  billingInterval?: MembershipPeriod | string | null;
  lockedPlanPriceBillingInterval?: MembershipPeriod | string | null;
  lastPaymentPeriod?: MembershipPeriod | string | null;
  lastPaymentPlanPriceBillingInterval?: MembershipPeriod | string | null;
  intervalMonths?: number | null;
}): MembershipPeriod | null {
  const fromLocked = normalizeBillingPeriodInput(
    input.lockedPlanPriceBillingInterval
  );
  if (fromLocked) return fromLocked;

  const fromPaymentPrice = normalizeBillingPeriodInput(
    input.lastPaymentPlanPriceBillingInterval
  );
  if (fromPaymentPrice) return fromPaymentPrice;

  const fromSub = normalizeBillingPeriodInput(input.billingInterval);
  if (fromSub) return fromSub;

  const fromPayment = normalizeBillingPeriodInput(input.lastPaymentPeriod);
  if (fromPayment) return fromPayment;

  if (input.intervalMonths != null) {
    return INTERVAL_MONTHS_TO_PERIOD[input.intervalMonths] ?? null;
  }

  return null;
}
