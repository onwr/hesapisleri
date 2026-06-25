"use client";

import { useEffect, useState } from "react";
import type { PosCollectionAccount } from "@/lib/pos-payment-account-utils";

export function usePosCollectionAccounts() {
  const [accounts, setAccounts] = useState<PosCollectionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/pos/collection-options");
        const result = (await response.json()) as {
          success?: boolean;
          data?: PosCollectionAccount[];
          message?: string;
        };

        if (cancelled) return;

        if (!response.ok || !result.success) {
          setAccounts([]);
          setError(result.message ?? "Tahsilat hesapları yüklenemedi.");
          return;
        }

        setAccounts(result.data ?? []);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setError("Tahsilat hesapları yüklenemedi.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { accounts, loading, error };
}
