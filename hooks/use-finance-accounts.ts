"use client";

import { useEffect, useState } from "react";
import type { FinanceAccountOption } from "@/lib/finance-account-utils";

export function useFinanceAccounts() {
  const [accounts, setAccounts] = useState<FinanceAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/cash-bank/accounts/finance-options");
        const result = (await response.json()) as {
          success?: boolean;
          data?: FinanceAccountOption[];
          message?: string;
        };

        if (cancelled) return;

        if (!response.ok || !result.success) {
          setAccounts([]);
          setError(result.message ?? "Ödeme hesapları yüklenemedi.");
          return;
        }

        setAccounts(result.data ?? []);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setError("Ödeme hesapları yüklenemedi.");
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
