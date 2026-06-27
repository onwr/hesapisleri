"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";
import type { AdminGlobalSearchResult } from "@/lib/admin/admin-overview-search-service";

const GROUP_LABELS: Record<keyof AdminGlobalSearchResult, string> = {
  companies: "Firmalar",
  users: "Kullanıcılar",
  subscriptions: "Abonelikler",
  payments: "Ödemeler",
  partners: "Partnerler",
};

export function AdminOverviewGlobalSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AdminGlobalSearchResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setError("");
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const res = await fetch(
            `/api/admin/search?q=${encodeURIComponent(query.trim())}`
          );
          const json = await res.json();
          if (!res.ok || !json.success) {
            setError(json.message || "Arama başarısız.");
            setResults(null);
            return;
          }
          setResults(json.data);
        } catch {
          setError("Arama sırasında hata oluştu.");
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const hasResults =
    results &&
    Object.values(results).some((group) => group.length > 0);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
        <Search size={16} className="text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Firma, kullanıcı, ödeme, abonelik veya referans kodu ara..."
          className="h-9 flex-1 bg-transparent text-[13px] font-medium text-[#0f1f4d] outline-none placeholder:text-slate-400"
        />
        {loading ? <Loader2 size={16} className="animate-spin text-slate-400" /> : null}
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-rose-600">{error}</p>
      ) : null}

      {query.trim().length >= 2 && results && !loading ? (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {!hasResults ? (
            <p className="px-2 py-4 text-center text-[12px] text-slate-500">
              Sonuç bulunamadı.
            </p>
          ) : (
            (Object.keys(GROUP_LABELS) as Array<keyof AdminGlobalSearchResult>).map(
              (groupKey) => {
                const items = results[groupKey];
                if (items.length === 0) return null;
                return (
                  <div key={groupKey} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {GROUP_LABELS[groupKey]}
                    </p>
                    {items.map((item) => (
                      <Link
                        key={`${groupKey}-${item.id}`}
                        href={item.href}
                        className="block rounded-xl px-2 py-2 hover:bg-blue-50/70"
                      >
                        <p className="text-[13px] font-bold text-[#0f1f4d]">
                          {item.label}
                        </p>
                        {item.meta ? (
                          <p className="text-[11px] text-slate-500">{item.meta}</p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                );
              }
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
