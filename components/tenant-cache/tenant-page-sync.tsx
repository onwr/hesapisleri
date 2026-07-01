"use client";

import { useTenantCacheSync } from "@/hooks/use-tenant-cache-sync";

type TenantPageSyncProps = {
  /** RSC ağacını yenile — liste/detay sayfaları için varsayılan true */
  refresh?: boolean;
};

/**
 * Server component sayfalarında tenant cache pub/sub dinleyicisi.
 * Mutation sonrası notifyTenantCacheSync ile eşleşir.
 */
export function TenantPageSync({ refresh = true }: TenantPageSyncProps) {
  useTenantCacheSync(() => {}, { refresh });
  return null;
}
