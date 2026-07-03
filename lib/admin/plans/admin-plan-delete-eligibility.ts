/**
 * Saf silme uygunluk değerlendirmesi — unit test için DB'siz.
 */
export type PlanDeleteUsageCounts = {
  subscriptions: number;
  payments: number;
  priceLinkedSubscriptions: number;
  priceLinkedPayments: number;
  couponScopes: number;
  campaignScopes: number;
};

export function evaluatePlanDeleteEligibility(counts: PlanDeleteUsageCounts): {
  canHardDelete: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (counts.subscriptions > 0) reasons.push("abonelik");
  if (counts.payments > 0) reasons.push("ödeme");
  if (counts.priceLinkedSubscriptions > 0) reasons.push("fiyat-abonelik");
  if (counts.priceLinkedPayments > 0) reasons.push("fiyat-ödeme");
  if (counts.couponScopes > 0) reasons.push("kupon");
  if (counts.campaignScopes > 0) reasons.push("kampanya");

  return { canHardDelete: reasons.length === 0, reasons };
}
