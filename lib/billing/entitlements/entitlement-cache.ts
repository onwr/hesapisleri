import type { CompanyEntitlementsResult } from "@/lib/billing/entitlements/entitlement-types";

type CacheEntry = {
  expiresAt: number;
  value: CompanyEntitlementsResult;
  versionKey: string;
};

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 30_000;

export function buildEntitlementCacheKey(companyId: string, versionKey: string) {
  return `${companyId}:${versionKey}`;
}

export function getCachedEntitlements(
  companyId: string,
  versionKey: string
): CompanyEntitlementsResult | null {
  const key = buildEntitlementCacheKey(companyId, versionKey);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  if (entry.versionKey !== versionKey) return null;
  return entry.value;
}

export function setCachedEntitlements(
  companyId: string,
  versionKey: string,
  value: CompanyEntitlementsResult,
  ttlMs = DEFAULT_TTL_MS
) {
  const key = buildEntitlementCacheKey(companyId, versionKey);
  cache.set(key, { value, versionKey, expiresAt: Date.now() + ttlMs });
}

export function invalidateCompanyEntitlementCache(companyId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${companyId}:`)) {
      cache.delete(key);
    }
  }
}

export function clearEntitlementCache() {
  cache.clear();
}
