import { revalidateTag } from "next/cache";

export function invalidateAdminCampaignCaches(campaignId?: string) {
  revalidateTag("admin-campaign-list", "max");
  revalidateTag("admin-overview", "max");
  revalidateTag("checkout-plan", "max");
  revalidateTag("subscription-plan-change-options", "max");
  if (campaignId) {
    revalidateTag(`admin-campaign-detail:${campaignId}`, "max");
    revalidateTag(`admin-campaign-usage:${campaignId}`, "max");
    revalidateTag(`admin-campaign-preview:${campaignId}`, "max");
  }
  revalidateTag("admin-plan-list-metrics", "max");
}
