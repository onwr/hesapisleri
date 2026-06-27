import { revalidateTag } from "next/cache";

export function invalidateAdminPlanCaches(planId?: string) {
  revalidateTag("admin-plan-list-metrics", "max");
  revalidateTag("admin-overview", "max");
  revalidateTag("checkout-plan", "max");
  if (planId) {
    revalidateTag(`admin-plan-detail:${planId}`, "max");
    revalidateTag(`admin-plan-prices:${planId}`, "max");
    revalidateTag(`admin-plan-features:${planId}`, "max");
    revalidateTag(`admin-plan-entitlements:${planId}`, "max");
  }
  revalidateTag("admin-subscription-list-metrics", "max");
  revalidateTag("subscription-plan-change-options", "max");
}

export function invalidateAdminPlanFeatureCaches(planId: string) {
  invalidateAdminPlanCaches(planId);
  revalidateTag(`admin-plan-feature-list:${planId}`, "max");
}

export function invalidateAdminPlanEntitlementCaches(planId: string) {
  invalidateAdminPlanCaches(planId);
  revalidateTag(`plan-entitlement-resolver:${planId}`, "max");
  revalidateTag("company-resolved-entitlements", "max");
}

export function invalidateAdminPlanNoteCaches(planId: string) {
  invalidateAdminPlanCaches(planId);
  revalidateTag(`admin-plan-notes:${planId}`, "max");
  revalidateTag(`admin-plan-history:${planId}`, "max");
  revalidateTag(`admin-plan-activity:${planId}`, "max");
  revalidateTag("admin-plan-list-note-counts", "max");
}
