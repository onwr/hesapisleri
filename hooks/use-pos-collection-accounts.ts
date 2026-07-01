"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import type { PosCollectionAccount } from "@/lib/pos-payment-account-utils";

export function usePosCollectionAccounts() {
  const [accounts, setAccounts] = useState<PosCollectionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pos/collection-options", { signal });
      const result = (await response.json()) as {
        success?: boolean;
        data?: PosCollectionAccount[];
        message?: string;
      };

      if (signal?.aborted) return;

      if (!response.ok || !result.success) {
        setAccounts([]);
        setError(result.message ?? "Tahsilat hesapları yüklenemedi.");
        return;
      }

      setAccounts(result.data ?? []);
    } catch (loadError) {
      if (signal?.aborted) return;
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setAccounts([]);
      setError("Tahsilat hesapları yüklenemedi.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const unsubscribe = subscribeTenantCacheSync(() => {
      void load();
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [load]);

  return { accounts, loading, error, refetch: load };
}
