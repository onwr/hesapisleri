import type { SubscriptionPriceChangePolicy } from "@prisma/client";
import { ADMIN_PRICE_POLICY_OPTIONS } from "@/lib/admin/plans/admin-plan-price-policy-labels";

const ADMIN_WIZARD_POLICIES = new Set(
  ADMIN_PRICE_POLICY_OPTIONS.map((o) => o.value)
);

/** Yönetici sihirbazında gösterilen ve backend'de uygulanan politikalar. */
export function isAdminWizardPricePolicy(
  policy: SubscriptionPriceChangePolicy | string
): boolean {
  return ADMIN_WIZARD_POLICIES.has(policy as SubscriptionPriceChangePolicy);
}

/** Mevcut fatura dönemindeki fiyatı değiştirir mi? */
export function policyChangesCurrentBillingPeriod(
  policy: SubscriptionPriceChangePolicy | string
): boolean {
  return policy === "AFTER_DATE";
}

/** Mevcut abonelerin kilitli/dönem fiyatını hemen değiştirir mi? */
export function policyAffectsExistingSubscribersNow(
  policy: SubscriptionPriceChangePolicy | string
): boolean {
  return policy === "AFTER_DATE";
}

/** Yenileme veya tarih politikası — mevcut dönem korunur. */
export function policyPreservesCurrentPeriod(
  policy: SubscriptionPriceChangePolicy | string
): boolean {
  return policy === "NEW_SUBSCRIBERS_ONLY" || policy === "NEXT_RENEWAL" || policy === "GRANDFATHERED";
}
