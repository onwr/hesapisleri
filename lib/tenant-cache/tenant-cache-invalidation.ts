import "server-only";

import { revalidateTag } from "next/cache";
import type { TenantEntityIds } from "./tenant-cache-domains";
import { buildTenantCacheTagsForDomains, getDashboardCacheTag } from "./tenant-cache-tags";
import {
  getDomainsForMutation,
  TENANT_MUTATION_INVALIDATION,
} from "./tenant-mutation-matrix";
import type { TenantMutationReason } from "./tenant-mutation-reasons";

export type InvalidateTenantCachesInput = {
  reason: TenantMutationReason;
  entityIds?: TenantEntityIds;
};

function isKnownMutationReason(reason: string): reason is TenantMutationReason {
  return Object.prototype.hasOwnProperty.call(TENANT_MUTATION_INVALIDATION, reason);
}

export function invalidateTenantCaches(
  companyId: string,
  input: InvalidateTenantCachesInput,
): void {
  if (!companyId) return;

  const domains = getDomainsForMutation(input.reason);
  const tags = buildTenantCacheTagsForDomains(
    companyId,
    domains,
    input.entityIds,
  );

  for (const tag of tags) {
    try {
      revalidateTag(tag, "max");
    } catch (error) {
      console.error("[tenant-cache-invalidation]", {
        companyId: `${companyId.slice(0, 6)}…`,
        reason: input.reason,
        tag,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  if (process.env.TENANT_CACHE_DEBUG === "true") {
    console.info("[tenant-cache-invalidation]", {
      companyId: `${companyId.slice(0, 6)}…`,
      reason: input.reason,
      tags: tags.length,
      entityIds: input.entityIds,
    });
  }
}

/** Bilinmeyen legacy reason — yalnız dashboard (önceki davranış). */
export function invalidateTenantCachesByLegacyReason(
  companyId: string,
  reason: string,
  entityIds?: TenantEntityIds,
): void {
  if (isKnownMutationReason(reason)) {
    invalidateTenantCaches(companyId, { reason, entityIds });
    return;
  }

  try {
    revalidateTag(getDashboardCacheTag(companyId), "max");
  } catch (error) {
    console.error("[tenant-cache-invalidation] legacy dashboard only", error);
  }
  console.warn("[tenant-cache-invalidation] unknown legacy reason:", reason);
}
