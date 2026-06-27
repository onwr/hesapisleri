import "server-only";

import { unstable_cache } from "next/cache";
import { getOnboardingMilestonesUncached } from "@/lib/onboarding/onboarding-progress";

const ONBOARDING_CACHE_SECONDS = 30;

function getOnboardingCacheTag(companyId: string) {
  return `onboarding:${companyId}`;
}

export async function getCachedOnboardingMilestones(companyId: string) {
  const runCached = unstable_cache(
    async () => getOnboardingMilestonesUncached(companyId),
    ["onboarding-milestones", companyId],
    {
      revalidate: ONBOARDING_CACHE_SECONDS,
      tags: [getOnboardingCacheTag(companyId)],
    }
  );

  return runCached();
}

export { getOnboardingCacheTag, ONBOARDING_CACHE_SECONDS };
