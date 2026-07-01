import "server-only";

import { revalidateTag } from "next/cache";
import type { TenantEntityIds } from "@/lib/tenant-cache/tenant-cache-domains";
import { invalidateTenantCachesByLegacyReason } from "@/lib/tenant-cache/tenant-cache-invalidation";
import { getDashboardCacheTag } from "@/lib/tenant-cache/tenant-cache-tags";

export { getDashboardCacheTag } from "@/lib/tenant-cache/tenant-cache-tags";
export {
  invalidateTenantCaches,
  type InvalidateTenantCachesInput,
} from "@/lib/tenant-cache/tenant-cache-invalidation";
export type { TenantCacheDomain, TenantEntityIds } from "@/lib/tenant-cache/tenant-cache-domains";
export type { TenantMutationReason } from "@/lib/tenant-cache/tenant-mutation-reasons";
export {
  TENANT_MUTATION_INVALIDATION,
  getDomainsForMutation,
} from "@/lib/tenant-cache/tenant-mutation-matrix";
export {
  getTenantCacheTag,
  buildTenantCacheTagsForDomains,
} from "@/lib/tenant-cache/tenant-cache-tags";

/**
 * Dashboard + ilgili tenant domain tag'lerini mutation reason'a göre temizler.
 * Mevcut çağrı noktaları için geriye dönük API.
 */
export function invalidateDashboardCache(
  companyId: string,
  reason?: string,
  entityIds?: TenantEntityIds,
): void {
  if (!companyId) return;

  if (!reason) {
    try {
      revalidateTag(getDashboardCacheTag(companyId), "max");
    } catch (error) {
      console.error("[dashboard-cache-invalidation] dashboard-only", error);
    }
    return;
  }

  invalidateTenantCachesByLegacyReason(companyId, reason, entityIds);
}
