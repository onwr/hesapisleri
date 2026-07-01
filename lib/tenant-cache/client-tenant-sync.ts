"use client";

type TenantCacheSyncListener = () => void;

const listeners = new Set<TenantCacheSyncListener>();

export function subscribeTenantCacheSync(listener: TenantCacheSyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyTenantCacheSync(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[tenant-cache-sync] listener error", error);
    }
  }
}
