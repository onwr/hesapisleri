"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { subscribeTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";

export type UseTenantCacheSyncOptions = {
  /** Server component ağacını yenile — varsayılan false (pub/sub yeterli) */
  refresh?: boolean;
  enabled?: boolean;
};

/**
 * Mutation sonrası tenant cache sync dinleyicisi.
 * Unmount'ta otomatik temizlenir; duplicate listener önlenir (stable ref).
 */
export function useTenantCacheSync(
  onSync: () => void | Promise<void>,
  options: UseTenantCacheSyncOptions = {},
) {
  const router = useRouter();
  const handlerRef = useRef(onSync);
  handlerRef.current = onSync;

  useEffect(() => {
    if (options.enabled === false) return;

    const unsubscribe = subscribeTenantCacheSync(() => {
      void handlerRef.current();
      if (options.refresh) {
        startTransition(() => router.refresh());
      }
    });

    return unsubscribe;
  }, [router, options.enabled, options.refresh]);
}
