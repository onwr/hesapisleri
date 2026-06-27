"use client";

import Link from "next/link";
import { appPanelClass, appTableClass, appTableHeadClass, appTableRowClass } from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMoney } from "@/lib/format-utils";

type OverviewData = {
  basics: Record<string, unknown>;
  legacyPrices: {
    monthly: number;
    quarterly: number;
    semiAnnual: number;
    yearly: number;
    currency: string;
    readOnly: boolean;
  };
  intervalSummaries: Array<{
    interval: string;
    intervalLabel: string;
    conflict: boolean;
    purchasable: boolean;
    effective: Record<string, unknown> | null;
  }>;
  subscriptionImpact: {
    active: number;
    trial: number;
    cancelAtPeriodEnd: number;
    withLockedPrice: number;
    withNextPrice: number;
    withoutPriceLock: number;
    grandfathered: number;
    mrrByCurrency: Record<string, number>;
  };
  issues: Array<{
    code: string;
    severity: string;
    message: string;
    label: string;
    tab?: string;
  }>;
};

export function AdminPlanOverviewTab({ data, planId }: { data: OverviewData; planId: string }) {
  const b = data.basics;

  return (
    <div className="space-y-4">
      <div className={`${appPanelClass} p-4`}>
        <h3 className="mb-3 text-[13px] font-bold text-slate-900">Temel bilgiler</h3>
        <dl className="grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["ID", b.id],
              ["Ad", b.name],
              ["Kod", b.code],
              ["Durum", b.planStatus],
              ["Görünürlük", b.visibility],
              ["Sıra", b.sortOrder],
              ["Trial", b.trialEnabled ? `${b.trialDays} gün` : "Kapalı"],
              ["Para birimi", b.defaultCurrency],
              ["KDV", `${b.vatRate}% ${b.vatIncluded ? "(dahil)" : "(hariç)"}`],
              ["Yayın", b.publishedAt ? formatAdminDate(String(b.publishedAt)) : "—"],
              ["Arşiv", b.archivedAt ? formatAdminDate(String(b.archivedAt)) : "—"],
              ["Oluşturma", formatAdminDate(String(b.createdAt))],
              ["Güncelleme", formatAdminDate(String(b.updatedAt))],
            ] as Array<[string, unknown]>
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className="font-medium text-slate-800">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
        {b.description ? (
          <p className="mt-3 text-[12px] text-slate-600">{String(b.description)}</p>
        ) : null}
      </div>

      <div className={`${appPanelClass} p-4`}>
        <h3 className="mb-3 text-[13px] font-bold text-slate-900">Fiyat özeti</h3>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Dönem</th>
                <th className="px-3 py-2">Liste</th>
                <th className="px-3 py-2">Satış</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Politika</th>
                <th className="px-3 py-2">Satın alınabilir</th>
              </tr>
            </thead>
            <tbody>
              {data.intervalSummaries.map((row) => (
                <tr key={row.interval} className={appTableRowClass}>
                  <td className="px-3 py-2 font-medium">{row.intervalLabel}</td>
                  <td className="px-3 py-2">
                    {row.effective ? formatMoney(Number(row.effective.salePrice)) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.effective ? formatMoney(Number(row.effective.listPrice)) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.conflict ? (
                      <Link
                        href={`/admin/plans/${planId}?tab=pricing`}
                        className="font-bold text-red-700 hover:underline"
                      >
                        PRICE_RESOLUTION_CONFLICT
                      </Link>
                    ) : row.effective ? (
                      String(row.effective.status)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {row.effective ? String(row.effective.priceChangePolicy) : "—"}
                  </td>
                  <td className="px-3 py-2">{row.purchasable ? "Evet" : "Hayır"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Legacy ({data.legacyPrices.currency}, salt okunur): Aylık{" "}
          {formatMoney(data.legacyPrices.monthly)} · Yıllık{" "}
          {formatMoney(data.legacyPrices.yearly)}
        </p>
      </div>

      <div className={`${appPanelClass} p-4`}>
        <h3 className="mb-3 text-[13px] font-bold text-slate-900">Abonelik etkisi</h3>
        <div className="grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
          <div>Aktif: {data.subscriptionImpact.active}</div>
          <div>Trial: {data.subscriptionImpact.trial}</div>
          <div>İptal bekleyen: {data.subscriptionImpact.cancelAtPeriodEnd}</div>
          <div>Fiyat kilidi: {data.subscriptionImpact.withLockedPrice}</div>
          <div>Kilitsiz: {data.subscriptionImpact.withoutPriceLock}</div>
          <div>Sonraki fiyat: {data.subscriptionImpact.withNextPrice}</div>
          <div>Grandfathered: {data.subscriptionImpact.grandfathered}</div>
        </div>
      </div>

      {data.issues.length > 0 ? (
        <div className={`${appPanelClass} p-4`}>
          <h3 className="mb-3 text-[13px] font-bold text-slate-900">Açık sorunlar</h3>
          <ul className="space-y-2">
            {data.issues.map((issue) => (
              <li key={issue.code} className="text-[12px]">
                <span
                  className={[
                    "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    issue.severity === "error"
                      ? "bg-red-100 text-red-800"
                      : issue.severity === "warning"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {issue.severity}
                </span>
                <strong>{issue.label}</strong> — {issue.message}
                {issue.tab === "pricing" ? (
                  <Link href={`/admin/plans/${planId}?tab=pricing`} className="ml-2 text-slate-700 underline">
                    Fiyatlandırma
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
