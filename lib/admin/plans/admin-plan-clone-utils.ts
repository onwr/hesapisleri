import type { MembershipPeriod, MembershipPlanPrice } from "@prisma/client";

/** Klon için fiyat: yeni plan, DRAFT, private, lifecycle sıfırlanır */
export function mapClonedPriceRow(
  source: Pick<
    MembershipPlanPrice,
    | "billingInterval"
    | "listPriceMinor"
    | "salePriceMinor"
    | "currency"
    | "vatRate"
    | "vatIncluded"
    | "monthlyEquivalentMinor"
    | "isAutoRenewEnabled"
    | "sortOrder"
    | "priceChangePolicy"
    | "adminNote"
  >,
  newPlanId: string,
  actorUserId: string
) {
  return {
    planId: newPlanId,
    billingInterval: source.billingInterval,
    version: 1,
    status: "DRAFT" as const,
    listPriceMinor: source.listPriceMinor,
    salePriceMinor: source.salePriceMinor,
    currency: source.currency,
    vatRate: source.vatRate,
    vatIncluded: source.vatIncluded,
    monthlyEquivalentMinor: source.monthlyEquivalentMinor,
    effectiveFrom: new Date(),
    effectiveUntil: null,
    isAutoRenewEnabled: source.isAutoRenewEnabled,
    isPublic: false,
    sortOrder: source.sortOrder,
    priceChangePolicy: source.priceChangePolicy,
    adminNote: source.adminNote,
    createdByUserId: actorUserId,
    publishedByUserId: null,
    publishedAt: null,
  };
}

/** Her billingInterval için en yüksek version kaydını al (ACTIVE/SCHEDULED lifecycle taşınmaz) */
export function pickPricesToClone(prices: MembershipPlanPrice[]): MembershipPlanPrice[] {
  const byInterval = new Map<MembershipPeriod, MembershipPlanPrice>();
  const sorted = [...prices].sort((a, b) => b.version - a.version);
  for (const price of sorted) {
    if (!byInterval.has(price.billingInterval)) {
      byInterval.set(price.billingInterval, price);
    }
  }
  return [...byInterval.values()];
}

export const CLONE_EXCLUDED_RELATIONS = [
  "CompanySubscription",
  "MembershipPayment",
  "PaymentRefund",
  "SubscriptionPendingChange",
  "MembershipCampaignScope",
  "MembershipCouponPlan",
  "CompanyPlanPriceOverride",
  "AdminPlanNote",
  "ActivityLog",
] as const;
