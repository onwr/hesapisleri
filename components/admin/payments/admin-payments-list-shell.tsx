"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appPanelClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMinor } from "@/lib/admin/subscriptions/admin-subscription-serializers";
import type { getAdminPaymentList } from "@/lib/admin/payments/admin-payment-list-service";
import type { getAdminPaymentMetrics } from "@/lib/admin/payments/admin-payment-metric-service";
import type { AdminPaymentListQuery } from "@/lib/admin/payments/admin-payment-schemas";

type List = Awaited<ReturnType<typeof getAdminPaymentList>>;
type Metrics = Awaited<ReturnType<typeof getAdminPaymentMetrics>>;

type Props = {
  list: List;
  metrics: Metrics;
  query: AdminPaymentListQuery;
};

function formatCurrencyMap(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (!entries.length) return "—";
  return entries.map(([cur, v]) => formatMinor(Math.round(v * 100), cur)).join(" · ");
}

export function AdminPaymentsListShell({ list, metrics, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function setPage(page: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(page));
    router.push(`${pathname}?${p.toString()}`);
  }

  const exportHref = `/api/admin/payments/export?${searchParams.toString()}`;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Ödemeler"
        description="Platform genelinde üyelik ödemelerini, callback durumlarını ve tutarsızlıkları inceleyin."
        primaryAction={
          <a
            href={exportHref}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            CSV Export
          </a>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {[
          { label: "Toplam", value: String(metrics.total), href: "/admin/payments" },
          { label: "Başarılı", value: String(metrics.paid), href: metrics.metricHrefs.paid },
          { label: "Bekleyen", value: String(metrics.pending), href: metrics.metricHrefs.pending },
          { label: "Başarısız", value: String(metrics.failed), href: metrics.metricHrefs.failed },
          { label: "İade", value: String(metrics.refunded), href: metrics.metricHrefs.refunded },
          { label: "Kısmi iade", value: String(metrics.partiallyRefunded), href: metrics.metricHrefs.partial },
          { label: "Bu ay tahsilat", value: formatCurrencyMap(metrics.collectedThisMonthByCurrency), href: metrics.metricHrefs.paid + "&dateRange=THIS_MONTH" },
          { label: "Bu ay iade", value: formatCurrencyMap(metrics.refundedThisMonthByCurrency), href: "/admin/payments?refund=FULL&dateRange=THIS_MONTH" },
          { label: "24s başarısız", value: String(metrics.failedLast24h), href: metrics.metricHrefs.failed24h },
          { label: "Callback sorunu", value: String(metrics.callbackIssues), href: metrics.metricHrefs.callbackIssues },
          { label: "Callback bekleyen", value: String(metrics.callbackWaiting), href: "/admin/payments?callback=WAITING" },
          { label: "Orphan ödeme", value: String(metrics.orphanPayments), href: metrics.metricHrefs.orphan },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300"
          >
            <p className="text-[11px] font-semibold uppercase text-slate-500">{card.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className={appPanelClass}>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            className={appInputClass}
            placeholder="Ara (min 2 karakter)…"
            defaultValue={query.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParam("q", (e.target as HTMLInputElement).value);
            }}
          />
          <select
            className={appSelectClass}
            value={query.status}
            onChange={(e) => updateParam("status", e.target.value)}
          >
            <option value="ALL">Tüm durumlar</option>
            <option value="PAID">Başarılı</option>
            <option value="PENDING">Bekleyen</option>
            <option value="WAIT_CALLBACK">Callback bekliyor</option>
            <option value="FAILED">Başarısız</option>
            <option value="REFUNDED">İade</option>
            <option value="PARTIALLY_REFUNDED">Kısmi iade</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <select
            className={appSelectClass}
            value={query.provider}
            onChange={(e) => updateParam("provider", e.target.value)}
          >
            <option value="ALL">Tüm providerlar</option>
            <option value="PAYTR">PayTR</option>
            <option value="MANUAL">Manual</option>
            <option value="LEGACY">Legacy</option>
            <option value="TRIAL_PLACEHOLDER">Trial placeholder</option>
          </select>
          <select
            className={appSelectClass}
            value={query.currency}
            onChange={(e) => updateParam("currency", e.target.value)}
          >
            <option value="ALL">Para birimi</option>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <select
            className={appSelectClass}
            value={query.dateRange}
            onChange={(e) => updateParam("dateRange", e.target.value)}
          >
            <option value="ALL">Tüm tarihler</option>
            <option value="TODAY">Bugün</option>
            <option value="LAST_24H">Son 24 saat</option>
            <option value="LAST_7D">Son 7 gün</option>
            <option value="LAST_30D">Son 30 gün</option>
            <option value="THIS_MONTH">Bu ay</option>
            <option value="LAST_MONTH">Geçen ay</option>
          </select>
          <select
            className={appSelectClass}
            value={query.pageSize}
            onChange={(e) => updateParam("pageSize", e.target.value)}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Ödeme</th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Abonelik</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Callback</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Sorun</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {list.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                list.items.map((row) => (
                  <tr key={row.id} className={appTableRowClass}>
                    <td className="px-3 py-2 font-mono text-xs">{row.shortId}…</td>
                    <td className="px-3 py-2">
                      <Link href={row.companyHref} className="text-sm font-semibold text-blue-700 hover:underline">
                        {row.company.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.subscription ? (
                        <Link href={row.subscription.href} className="text-blue-600 hover:underline">
                          {row.subscription.status}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold">
                      {formatMinor(row.amountMinor, row.currency)}
                      {row.refundedMinor > 0 && (
                        <span className="block text-xs text-violet-600">
                          iade: {formatMinor(row.refundedMinor, row.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.statusClass}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{row.provider}</td>
                    <td className="px-3 py-2 text-xs">{row.callbackStatus}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {formatAdminDate(row.paidAt ?? row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.issues.slice(0, 2).map((i) => (
                          <span key={i.code} className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
                            {i.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={row.detailHref} className="text-xs font-semibold text-blue-600 hover:underline">
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {list.totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              disabled={list.page <= 1}
              onClick={() => setPage(list.page - 1)}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Önceki
            </button>
            <span className="px-2 py-1 text-sm text-slate-500">
              {list.page} / {list.totalPages}
            </span>
            <button
              type="button"
              disabled={list.page >= list.totalPages}
              onClick={() => setPage(list.page + 1)}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </AdminPageContainer>
  );
}
