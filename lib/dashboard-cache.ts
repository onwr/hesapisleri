import "server-only";

import { unstable_cache } from "next/cache";
import {
  buildDashboardCacheKeyParts,
  getDashboardScopedCacheTag,
} from "@/lib/dashboard-period-utils";
import {
  getDashboardPageDataUncached,
  type DashboardPageData,
  type DashboardPageDataInput,
} from "@/lib/dashboard-page-data";
import { getDashboardCacheTag } from "@/lib/dashboard-cache-tags";

const DASHBOARD_CACHE_SECONDS = 60;

function logDashboardCacheDebug(
  event: "miss",
  input: DashboardPageDataInput,
  durationMs?: number
) {
  if (process.env.DASHBOARD_CACHE_DEBUG !== "true") return;

  console.info("[dashboard-cache]", {
    event,
    companyId: `${input.companyId.slice(0, 6)}…`,
    periodKey: input.periodKey,
    durationMs,
  });
}

export async function getCachedDashboardPageData(
  input: DashboardPageDataInput
): Promise<DashboardPageData> {
  const companyTag = getDashboardCacheTag(input.companyId);
  const scopedTag = getDashboardScopedCacheTag(input);
  const keyParts = buildDashboardCacheKeyParts(input);

  const runCached = unstable_cache(
    async () => {
      const startedAt = Date.now();
      logDashboardCacheDebug("miss", input);

      const data = await getDashboardPageDataUncached(input);

      logDashboardCacheDebug("miss", input, Date.now() - startedAt);
      return data;
    },
    [...keyParts],
    {
      revalidate: DASHBOARD_CACHE_SECONDS,
      tags: [companyTag, scopedTag],
    }
  );

  return runCached();
}

export { DASHBOARD_CACHE_SECONDS };
