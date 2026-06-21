import "server-only";

import { revalidateTag } from "next/cache";
import { getDashboardCacheTag } from "@/lib/dashboard-cache-tags";

export { getDashboardCacheTag } from "@/lib/dashboard-cache-tags";

export function invalidateDashboardCache(companyId: string, reason?: string) {
  if (!companyId) return;

  try {
    revalidateTag(getDashboardCacheTag(companyId), "max");
  } catch (error) {
    console.error("[dashboard-cache-invalidation]", {
      companyId: `${companyId.slice(0, 6)}…`,
      reason: reason ?? "mutation",
      error: error instanceof Error ? error.message : error,
    });
  }

  if (process.env.DASHBOARD_CACHE_DEBUG === "true") {
    console.info("[dashboard-cache-invalidation]", {
      companyId: `${companyId.slice(0, 6)}…`,
      reason: reason ?? "mutation",
    });
  }
}
