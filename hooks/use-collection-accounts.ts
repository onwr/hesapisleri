"use client";

import { useEffect, useMemo, useState } from "react";
import {
  resolveDefaultCollectionAccountId,
  type CollectionAccountOption,
} from "@/lib/collection-account-utils";

export function useCollectionAccounts(preferredAccountId?: string | null) {
  const [accounts, setAccounts] = useState<CollectionAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/cash-bank/accounts/collection-options");
        const result = (await response.json()) as {
          success?: boolean;
          data?: CollectionAccountOption[];
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

  const defaultAccountId = useMemo(
    () => resolveDefaultCollectionAccountId(accounts, preferredAccountId),
    [accounts, preferredAccountId]
  );

  return { accounts, loading, error, defaultAccountId };
}
