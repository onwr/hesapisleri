import type { CampaignListFilters } from "@/lib/admin/promotions/promotion-types";
import { parseCampaignListFilters } from "@/lib/admin/promotions/promotion-filter-utils";

export function parseCampaignApiFilters(
  searchParams: URLSearchParams
): CampaignListFilters {
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return parseCampaignListFilters(params);
}
