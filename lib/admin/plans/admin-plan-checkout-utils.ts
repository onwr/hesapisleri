import type { MembershipPeriod, PlanStatus, PlanVisibility } from "@prisma/client";
import type { PlanPricingClass } from "@/lib/admin/plans/admin-plan-classification";

/**
 * Checkout yalnızca standard plan + gerçek satın alınabilir fiyat kapasitesi.
 * Çoklu plan kataloğu ayrı faz.
 */
export function isPlanCheckoutAvailable(input: {
  planStatus: PlanStatus;
  visibility: PlanVisibility;
  code: string;
  pricingClass: PlanPricingClass;
  hasPriceConflicts: boolean;
  isActive?: boolean;
}): boolean {
  if (input.code !== "standard") return false;
  if (input.planStatus !== "ACTIVE") return false;
  if (input.isActive === false) return false;
  if (input.visibility !== "PUBLIC") return false;
  if (input.hasPriceConflicts) return false;
  if (input.pricingClass === "UNCONFIGURED") return false;
  return true;
}

export function isStandardPlanPurchasable(input: {
  planStatus: PlanStatus;
  visibility: PlanVisibility;
  pricingClass: PlanPricingClass;
  hasPriceConflicts: boolean;
}): boolean {
  return isPlanCheckoutAvailable({
    ...input,
    code: "standard",
  });
}

export const CHECKOUT_MULTI_PLAN_DEFERRED =
  "Çoklu plan checkout kataloğu ayrı ürün fazında ele alınacaktır.";
