import "server-only";

import { unstable_cache } from "next/cache";
import type { TenantCacheDomain } from "./tenant-cache-domains";
import { getTenantCacheTag } from "./tenant-cache-tags";

export const TENANT_PAGE_CACHE_SECONDS = 60;

export type TenantPageCacheConfig<TArgs extends { companyId: string }, TResult> = {
  domain: TenantCacheDomain;
  cacheKey: (args: TArgs) => string[];
  entityId?: (args: TArgs) => string | undefined;
  loader: (args: TArgs) => Promise<TResult>;
  revalidate?: number;
};

export function withTenantPageCache<TArgs extends { companyId: string }, TResult>(
  config: TenantPageCacheConfig<TArgs, TResult>,
): (args: TArgs) => Promise<TResult> {
  return async function getCachedPageData(args: TArgs): Promise<TResult> {
    const entityId = config.entityId?.(args);
    const listTag = getTenantCacheTag(args.companyId, config.domain);
    const scopedTag = entityId
      ? getTenantCacheTag(args.companyId, config.domain, entityId)
      : listTag;

    const runCached = unstable_cache(
      () => config.loader(args),
      [...config.cacheKey(args), args.companyId, entityId ?? "list"],
      {
        revalidate: config.revalidate ?? TENANT_PAGE_CACHE_SECONDS,
        tags: entityId ? [scopedTag, listTag] : [listTag],
      },
    );

    return runCached();
  };
}
