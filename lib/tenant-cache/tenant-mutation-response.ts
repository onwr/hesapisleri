import "server-only";

import type { TenantCacheDomain, TenantEntityIds } from "./tenant-cache-domains";
import {
  invalidateTenantCaches,
  type InvalidateTenantCachesInput,
} from "./tenant-cache-invalidation";
import { getDomainsForMutation } from "./tenant-mutation-matrix";

export type TenantMutationSuccessBody<TEntity = Record<string, unknown>> = {
  success: true;
  message?: string;
  data: TEntity & {
    affectedIds?: string[];
    balances?: Record<string, number | null>;
    stocks?: Record<string, number | null>;
    status?: string;
  };
  invalidatedDomains: TenantCacheDomain[];
};

function collectAffectedIds(
  entityIds?: TenantEntityIds,
  entity?: Record<string, unknown>,
  extraIds?: string[],
): string[] {
  const ids = new Set<string>();
  if (entityIds) {
    for (const value of Object.values(entityIds)) {
      if (value) ids.add(value);
    }
  }
  if (entity?.id && typeof entity.id === "string") ids.add(entity.id);
  if (extraIds) {
    for (const id of extraIds) ids.add(id);
  }
  return [...ids];
}

export function buildTenantMutationSuccess<TEntity extends Record<string, unknown>>(
  companyId: string,
  input: InvalidateTenantCachesInput & {
    entity: TEntity;
    message?: string;
    status?: string;
    balances?: Record<string, number | null>;
    stocks?: Record<string, number | null>;
    affectedIds?: string[];
    extra?: Record<string, unknown>;
  },
): TenantMutationSuccessBody<TEntity & Record<string, unknown>> {
  invalidateTenantCaches(companyId, {
    reason: input.reason,
    entityIds: input.entityIds,
  });

  const invalidatedDomains = [...getDomainsForMutation(input.reason)];

  return {
    success: true,
    message: input.message,
    data: {
      ...input.entity,
      ...input.extra,
      affectedIds: collectAffectedIds(input.entityIds, input.entity, input.affectedIds),
      balances: input.balances,
      stocks: input.stocks,
      status: input.status ?? "ok",
    },
    invalidatedDomains,
  };
}
