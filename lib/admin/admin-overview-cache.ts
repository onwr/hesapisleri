import { unstable_cache } from "next/cache";
import {
  buildAdminOverviewCacheKey,
  type AdminOverviewQuery,
} from "@/lib/admin/admin-overview-period-utils";
import { getAdminOverview } from "@/lib/admin/admin-overview-service";

export async function getCachedAdminOverview(query: AdminOverviewQuery = {}) {
  const cacheKey = buildAdminOverviewCacheKey(query);

  return unstable_cache(
    () => getAdminOverview(query),
    ["admin-overview", cacheKey],
    { revalidate: 45 }
  )();
}
