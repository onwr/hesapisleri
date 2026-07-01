"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import type { FinanceAccountOption } from "@/lib/finance-account-utils";

export function useFinanceAccounts() {
  const [accounts, setAccounts] = useState<FinanceAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/cash-bank/accounts/finance-options", {
        signal,
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: FinanceAccountOption[];
        message?: string;
      };

      if (signal?.aborted) return;

      if (!response.ok || !result.success) {
        setAccounts([]);
        setError(result.message ?? "Ödeme hesapları yüklenemedi.");
        return;
      }

      setAccounts(result.data ?? []);
    } catch (loadError) {
      if (signal?.aborted) return;
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setAccounts([]);
      setError("Ödeme hesapları yüklenemedi.");
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
