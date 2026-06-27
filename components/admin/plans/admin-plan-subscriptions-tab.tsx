"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  appOutlineButtonClass,
  appPanelClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";

type SubData = {
  summary: Record<string, number | Record<string, number>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: Array<{
    subscriptionId: string;
    subscriptionShortId: string;
    status: string;
    startedAt: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    company: { id: string; shortId: string; name: string; status: string; href: string };
    billingInterval: string | null;
    priceSnapshot: string;
    priceSource: string;
    lockedPlanPriceId: string | null;
    lockedPriceMinor: number | null;
    currency: string;
    nextPlanPriceId: string | null;
    nextPriceEffectiveAt: string | null;
    priceLockType: string | null;
    isGrandfathered: boolean;
    hasNextRenewalChange: boolean;
    monthlyRevenue: number | null;
    mrrCurrency: string;
    issues: Array<{ code: string; severity: string; message: string }>;
    links: { subscription: string; company: string; payments: string };
  }>;
};

type Props = { planId: string; data: SubData | null };

export function AdminPlanSubscriptionsTab({ planId, data: initial }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", "subscriptions");
    const subPage = p.get("subscriptionsPage") ?? p.get("page");
    p.delete("page");
    p.delete("historyPage");
    p.delete("activityPage");
    if (subPage) p.set("subscriptionsPage", subPage);
    return p.toString();
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/subscriptions?${queryString}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [planId, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", "subscriptions");
      if (q.trim().length >= 2) p.set("q", q.trim());
      else p.delete("q");
      router.replace(`${pathname}?${p.toString()}`);
    }, 400);
    return () => clearTimeout(t);
  }, [q, pathname, router, searchParams]);

  if (!data && !loading) {
    return <p className="text-[12px] text-red-600">Abonelik verisi yüklenemedi.</p>;
  }

  const summary = data?.summary;
  const mrr = (summary?.mrrByCurrency ?? {}) as Record<string, number>;

  function setFilter(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", "subscriptions");
    if (value && value !== "ALL") p.set(key, value);
    else p.delete(key);
    p.delete("subscriptionsPage");
    p.delete("page");
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div>
      {summary ? (
        <div className={`${appPanelClass} mb-4 grid gap-2 p-4 text-[11px] text-slate-600 md:grid-cols-3`}>
          <span>Toplam: {summary.total as number}</span>
          <span>Aktif: {summary.active as number}</span>
          <span>Trial: {summary.trial as number}</span>
          <span>Past due: {summary.pastDue as number}</span>
          <span>Dönem sonu iptal: {summary.cancelAtPeriodEnd as number}</span>
          <span>Grandfathered: {summary.grandfathered as number}</span>
          <span>Fiyat kilidi: {summary.withPriceLock as number}</span>
          <span>Gelecek fiyat: {summary.withNextPrice as number}</span>
          <span>Kilitsiz: {summary.withoutPriceLock as number}</span>
          <span>Duplicate firma: {summary.duplicateActiveCompanyCount as number}</span>
          <span>Çözümlenemeyen fiyat: {summary.unresolvedSubscriptionCount as number}</span>
          <span className="md:col-span-3">
            MRR: {Object.entries(mrr).map(([c, v]) => `${v.toLocaleString("tr-TR")} ${c}`).join(" · ") || "—"}
          </span>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
        <input
          className="rounded border px-2 py-1"
          placeholder="Ara (min 2 karakter)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border px-2 py-1"
          value={searchParams.get("status") ?? "ALL"}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="ALL">Tüm durumlar</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="PAST_DUE">PAST_DUE</option>
          <option value="CANCEL_AT_PERIOD_END">CANCEL_AT_PERIOD_END</option>
        </select>
        <select
          className="rounded border px-2 py-1"
          value={searchParams.get("locked") ?? "ALL"}
          onChange={(e) => setFilter("locked", e.target.value)}
        >
          <option value="ALL">Kilit: tümü</option>
          <option value="LOCKED">Kilitli</option>
          <option value="UNLOCKED">Kilitsiz</option>
        </select>
        <select
          className="rounded border px-2 py-1"
          value={searchParams.get("pageSize") ?? "25"}
          onChange={(e) => setFilter("pageSize", e.target.value)}
        >
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      {error ? <p className="mb-2 text-[12px] text-red-600">{error}</p> : null}
      {loading ? <p className="text-[12px] text-slate-500">Yükleniyor…</p> : null}

      {data && data.items.length === 0 ? (
        <p className="text-[12px] text-slate-500">Bu plana bağlı abonelik yok.</p>
      ) : data ? (
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-2 py-2">Firma</th>
                <th className="px-2 py-2">Abonelik</th>
                <th className="px-2 py-2">Fiyat</th>
                <th className="px-2 py-2">Politika</th>
                <th className="px-2 py-2">MRR</th>
                <th className="px-2 py-2">Sorun</th>
                <th className="px-2 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.subscriptionId} className={appTableRowClass}>
                  <td className="px-2 py-2 text-[11px]">
                    <Link href={row.links.company} className="font-bold text-blue-700">
                      {row.company.name}
                    </Link>
                    <div className="text-[10px] text-slate-500">{row.company.shortId}… · {row.company.status}</div>
                  </td>
                  <td className="px-2 py-2 text-[11px]">
                    <div>{row.status}</div>
                    <div className="font-mono text-[10px]">{row.subscriptionShortId}…</div>
                    <div className="text-[10px]">{formatAdminDate(row.startedAt)}</div>
                    {row.currentPeriodEnd ? (
                      <div className="text-[10px]">Bitiş: {formatAdminDate(row.currentPeriodEnd)}</div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-[10px]">
                    <div>{row.priceSnapshot}</div>
                    <div>{row.billingInterval ?? "—"} · {row.currency}</div>
                    {row.nextPlanPriceId ? <div>Sonraki: {row.nextPlanPriceId.slice(0, 8)}…</div> : null}
                  </td>
                  <td className="px-2 py-2 text-[10px]">
                    {row.priceLockType ?? "—"}
                    {row.isGrandfathered ? " · GF" : ""}
                  </td>
                  <td className="px-2 py-2 text-[11px]">
                    {row.monthlyRevenue != null ? `${row.monthlyRevenue} ${row.mrrCurrency}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-[10px] text-amber-700">
                    {row.issues.length ? row.issues.map((i) => i.message).join("; ") : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1 text-[10px]">
                      <Link href={row.links.subscription}>Abonelik</Link>
                      <Link href={row.links.payments}>Ödemeler</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-slate-500">
            Sayfa {data.page}/{data.totalPages} · {data.total} kayıt
          </p>
        </div>
      ) : null}
    </div>
  );
}
