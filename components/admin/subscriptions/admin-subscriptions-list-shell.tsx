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
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusClass,
  getPaymentStatusLabel,
  getBillingIntervalLabel,
  formatMinor,
} from "@/lib/admin/subscriptions/admin-subscription-serializers";
import { getIssueLabel } from "@/lib/admin/subscriptions/admin-subscription-issue-service";
import type {
  getAdminSubscriptionList,
} from "@/lib/admin/subscriptions/admin-subscription-list-service";
import type { getAdminSubscriptionMetrics } from "@/lib/admin/subscriptions/admin-subscription-metric-service";
import type { AdminSubListQuery } from "@/lib/admin/subscriptions/admin-subscription-schemas";

type SubscriptionList = Awaited<ReturnType<typeof getAdminSubscriptionList>>;
type Metrics = Awaited<ReturnType<typeof getAdminSubscriptionMetrics>>;

type Plan = { id: string; name: string; code: string };

type Props = {
  list: SubscriptionList;
  metrics: Metrics;
  query: AdminSubListQuery;
  plans: Plan[];
};

const METRIC_CARDS = [
  { key: "total", label: "Toplam" },
  { key: "active", label: "Aktif" },
  { key: "trial", label: "Trial" },
  { key: "pastDue", label: "Past Due" },
  { key: "cancelAtPeriodEnd", label: "İptal Edilecek" },
  { key: "cancelled", label: "İptal" },
  { key: "expired", label: "Süresi Dolmuş" },
  { key: "startingThisMonth", label: "Bu ay başlayan" },
  { key: "renewingThisMonth", label: "Bu ay yenilenen" },
  { key: "endingIn7Days", label: "7 gün içinde bitiyor" },
  { key: "paymentFailed", label: "Ödeme başarısız" },
  { key: "noActivePlan", label: "Plan yok" },
] as const;

export function AdminSubscriptionsListShell({ list, metrics, query, plans }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL" && value !== "all") {
      p.set(key, value);
    } else {
      p.delete(key);
    }
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function setPage(page: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(page));
    router.push(`${pathname}?${p.toString()}`);
  }

  const mrrTry = metrics.mrr["TRY"] ?? 0;
  const arrTry = metrics.arr["TRY"] ?? 0;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader title="Abonelik Yönetimi" description="Platform abonelikleri ve fatura takibi" />

      {/* Metric Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {METRIC_CARDS.map(({ key, label }) => (
          <div key={key} className={`${appPanelClass} p-3 text-center`}>
            <div className="text-2xl font-bold text-slate-800">
              {metrics[key as keyof typeof metrics] as number}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{label}</div>
          </div>
        ))}
        <div className={`${appPanelClass} p-3 text-center`}>
          <div className="text-lg font-bold text-emerald-700">
            {formatMinor(mrrTry * 100, "TRY")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">MRR</div>
        </div>
        <div className={`${appPanelClass} p-3 text-center`}>
          <div className="text-lg font-bold text-blue-700">
            {formatMinor(arrTry * 100, "TRY")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">ARR</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${appPanelClass} mb-4 flex flex-wrap items-end gap-3 p-4`}>
        <input
          className={`${appInputClass} min-w-[220px] flex-1`}
          placeholder="Firma, plan, e-posta ara…"
          defaultValue={query.q ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val.length === 0 || val.length >= 2) updateParam("q", val);
          }}
        />
        <select
          className={appSelectClass}
          defaultValue={query.status}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="ALL">Tüm Durumlar</option>
          {(["ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END", "EXPIRED", "CANCELLED", "SUSPENDED"] as const).map((s) => (
            <option key={s} value={s}>{getSubscriptionStatusLabel(s)}</option>
          ))}
        </select>
        <select
          className={appSelectClass}
          defaultValue={query.planId ?? ""}
          onChange={(e) => updateParam("planId", e.target.value)}
        >
          <option value="">Tüm Planlar</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          className={appSelectClass}
          defaultValue={query.billingInterval}
          onChange={(e) => updateParam("billingInterval", e.target.value)}
        >
          <option value="ALL">Tüm Dönemler</option>
          {(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const).map((i) => (
            <option key={i} value={i}>{getBillingIntervalLabel(i)}</option>
          ))}
        </select>
        <a
          href={`${pathname}?${new URLSearchParams({ ...Object.fromEntries(searchParams), export: "csv" }).toString()}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          CSV İndir
        </a>
      </div>

      {/* Table */}
      <div className={`${appPanelClass} overflow-x-auto`}>
        <table className={appTableClass}>
          <thead>
            <tr>
              {[
                "Firma", "Plan", "Durum", "Dönem", "Dönem Sonu",
                "Son Ödeme", "Aylık Gelir", "Sorunlar", ""
              ].map((h) => (
                <th key={h} className={appTableHeadClass}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.items.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                  Abonelik bulunamadı.
                </td>
              </tr>
            )}
            {list.items.map((sub) => (
              <tr key={sub.id} className={appTableRowClass}>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/subscriptions/${sub.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {sub.companyName}
                  </Link>
                  {sub.owner && (
                    <div className="text-[11px] text-slate-400">{sub.owner.email}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-sm">
                  {sub.planName ?? <span className="text-rose-500">Plan yok</span>}
                  {sub.isFree && (
                    <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">Ücretsiz</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getSubscriptionStatusClass(sub.status)}`}>
                    {getSubscriptionStatusLabel(sub.status)}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">
                  {getBillingIntervalLabel(sub.billingInterval)}
                </td>
                <td className="px-3 py-2 text-sm text-slate-600">
                  {sub.currentPeriodEnd ? formatAdminDate(sub.currentPeriodEnd) : "—"}
                </td>
                <td className="px-3 py-2 text-sm">
                  {sub.lastPayment ? (
                    <span>
                      <span className="text-slate-600">
                        {getPaymentStatusLabel(sub.lastPayment.status)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm font-medium text-slate-700">
                  {sub.monthlyRevenue != null ? formatMinor(sub.monthlyRevenue, sub.currency) : "—"}
                </td>
                <td className="px-3 py-2">
                  {sub.issues.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sub.issues.slice(0, 2).map((issue) => (
                        <span
                          key={issue}
                          className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600"
                          title={getIssueLabel(issue)}
                        >
                          {getIssueLabel(issue).slice(0, 20)}…
                        </span>
                      ))}
                      {sub.issues.length > 2 && (
                        <span className="text-[10px] text-slate-400">+{sub.issues.length - 2}</span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/subscriptions/${sub.id}`}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Detay →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {list.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            {list.total} abonelik · Sayfa {list.page} / {list.totalPages}
          </span>
          <div className="flex gap-2">
            {list.page > 1 && (
              <button onClick={() => setPage(list.page - 1)} className="rounded border px-3 py-1 hover:bg-slate-50">
                ← Önceki
              </button>
            )}
            {list.page < list.totalPages && (
              <button onClick={() => setPage(list.page + 1)} className="rounded border px-3 py-1 hover:bg-slate-50">
                Sonraki →
              </button>
            )}
          </div>
        </div>
      )}
    </AdminPageContainer>
  );
}
