import type { TenantCacheDomain, TenantEntityIds } from "./tenant-cache-domains";

/** Geriye dönük uyumluluk — dashboard tag aynı kalır. */
export function getDashboardCacheTag(companyId: string): string {
  return `dashboard:${companyId}`;
}

export function getTenantCacheTag(
  companyId: string,
  domain: TenantCacheDomain,
  entityId?: string,
): string {
  const base = `tenant:${domain}:${companyId}`;
  return entityId ? `${base}:${entityId}` : base;
}

const DOMAIN_ENTITY_KEY: Partial<
  Record<TenantCacheDomain, keyof TenantEntityIds>
> = {
  "sale-detail": "saleId",
  "product-detail": "productId",
  "warehouse-stock": "warehouseId",
  "customer-detail": "customerId",
  "customer-ledger": "customerId",
  "supplier-detail": "supplierId",
  "supplier-ledger": "supplierId",
  "employee-detail": "employeeId",
};

export function resolveTenantEntityIdForDomain(
  domain: TenantCacheDomain,
  entityIds?: TenantEntityIds,
): string | undefined {
  if (!entityIds) return undefined;
  const key = DOMAIN_ENTITY_KEY[domain];
  return key ? entityIds[key] : undefined;
}

export function buildTenantCacheTagsForDomains(
  companyId: string,
  domains: readonly TenantCacheDomain[],
  entityIds?: TenantEntityIds,
): string[] {
  const tags = new Set<string>();

  for (const domain of domains) {
    if (domain === "dashboard") {
      tags.add(getDashboardCacheTag(companyId));
      continue;
    }

    const entityId = resolveTenantEntityIdForDomain(domain, entityIds);
    tags.add(getTenantCacheTag(companyId, domain, entityId));

    // Entity-scoped tag varsa liste tag'ini de temizle
    if (entityId) {
      tags.add(getTenantCacheTag(companyId, domain));
    }
  }

  return [...tags];
}
