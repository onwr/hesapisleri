import { revalidateTag } from "next/cache";

export function invalidateAdminSubscriptionCaches(
  subscriptionId?: string,
  companyId?: string
) {
  revalidateTag("admin-subscription-list-metrics", "max");
  if (subscriptionId) {
    revalidateTag(`admin-subscription-detail:${subscriptionId}`, "max");
    revalidateTag(`subscription-payments:${subscriptionId}`, "max");
    revalidateTag(`subscription-history:${subscriptionId}`, "max");
  }
  if (companyId) {
    revalidateTag(`admin-company-detail:${companyId}`, "max");
    revalidateTag("admin-company-list-metrics", "max");
    revalidateTag(`company-billing:${companyId}`, "max");
  }
}
