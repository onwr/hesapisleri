"use client";

import Link from "next/link";
import { Archive, Megaphone, PauseCircle, PlayCircle } from "lucide-react";
import { AdminCampaignFilters } from "@/components/admin/promotions/admin-campaign-filters";
import { AdminCampaignRowActions } from "@/components/admin/admin-campaign-row-actions";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type { CampaignListFilters } from "@/lib/admin/promotions/promotion-types";
import {
  formatCampaignScopeSummary,
  formatDiscountLabel,
  formatIntervalLabel,
} from "@/lib/admin/promotions/promotion-scope-utils";
import {
  getCampaignStatusBadgeClass,
  getCampaignStatusLabel,
} from "@/lib/admin/promotions/promotion-filter-utils";
import type { getCampaignSummary, listCampaigns } from "@/lib/admin/promotions/campaign-query-service";

type ListData = Awaited<ReturnType<typeof listCampaigns>>;
type SummaryData = Awaited<ReturnType<typeof getCampaignSummary>>;
type Plan = { id: string; name: string };

function planSummary(
  scopes: ListData["items"][number]["scopes"]
) {
  const names = [...new Set(scopes.map((s) => s.plan?.name).filter(Boolean))] as string[];
  return names.length ? names.join(" + ") : "Tüm Planlar";
}

function intervalSummary(
  scopes: ListData["items"][number]["scopes"]
) {
  const intervals = [
    ...new Set(scopes.map((s) => s.billingInterval).filter(Boolean)),
  ] as Parameters<typeof formatIntervalLabel>[0][];
  if (!intervals.length) return "Tüm Dönemler";
  return intervals.map((i) => formatIntervalLabel(i)).join(", ");
}

export function AdminMembershipCampaignsContent({
  list,
  summary,
  filters,
  plans,
  activeFilterCount,
}: {
  list: ListData;
  summary: SummaryData;
  filters: CampaignListFilters;
  plans: Plan[];
  activeFilterCount: number;
}) {
  const { items, pagination } = list;
  const hasFilters =
    activeFilterCount > 0 || Boolean(filters.q?.trim());

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Kampanyalar"
        description="Üyelik planları için dönemsel indirim ve promosyonları yönetin."
        primaryAction={
          <Link href="/admin/campaigns/new" className={appPrimaryButtonClass}>
            Yeni Kampanya
          </Link>
        }
        secondaryActions={
          <Link href="/admin/membership-plans/preview" className={appOutlineButtonClass}>
            Fiyat Önizleme
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard title="Toplam" value={String(summary.total)} icon={Megaphone} tone="blue" />
        <AdminStatCard title="Taslak" value={String(summary.draft)} icon={Megaphone} tone="purple" />
        <AdminStatCard title="Aktif" value={String(summary.active)} icon={PlayCircle} tone="green" />
        <AdminStatCard title="Zamanlanmış" value={String(summary.scheduled)} icon={PauseCircle} tone="amber" />
        <AdminStatCard title="Yakında Bitecek" value={String(summary.endingSoon)} icon={Archive} tone="amber" />
        <AdminStatCard title="Limit Dolu" value={String(summary.usageLimitReached)} icon={Archive} tone="blue" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard title="Sona Ermiş" value={String(summary.expired)} icon={Archive} tone="purple" />
        <AdminStatCard title="Arşiv" value={String(summary.archived)} icon={Archive} tone="blue" />
        <AdminStatCard title="Yakında Başlayacak" value={String(summary.startingSoon)} icon={PlayCircle} tone="green" />
        <AdminStatCard title="Hedefsiz" value={String(summary.noTarget)} icon={Megaphone} tone="amber" />
        <AdminStatCard title="Fiyat Sorunu" value={String(summary.priceResolutionIssues)} icon={Megaphone} tone="amber" />
      </div>

      <AdminCampaignFilters
        filters={filters}
        plans={plans}
        activeFilterCount={activeFilterCount}
      />

      {items.length === 0 ? (
        <div className={`${appPanelClass} px-6 py-16 text-center`}>
          <p className="text-[15px] font-bold text-[#0f1f4d]">
            {hasFilters
              ? "Aramanızla eşleşen kampanya bulunamadı."
              : "Henüz kampanya oluşturulmamış."}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {hasFilters
              ? "Filtreleri temizleyerek tekrar deneyin."
              : "İlk kampanyanızı oluşturmak için Yeni Kampanya butonunu kullanın."}
          </p>
        </div>
      ) : (
        <>
          <div className={`${appPanelClass} hidden overflow-x-auto p-4 md:block`}>
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Kampanya</th>
                  <th className="px-3 py-2">İndirim</th>
                  <th className="px-3 py-2">Kapsam</th>
                  <th className="px-3 py-2">Planlar</th>
                  <th className="px-3 py-2">Dönemler</th>
                  <th className="px-3 py-2">Başlangıç</th>
                  <th className="px-3 py-2">Bitiş</th>
                  <th className="px-3 py-2">Kullanım / Limit</th>
                  <th className="px-3 py-2">Para Birimi</th>
                  <th className="px-3 py-2">Sorunlar</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`${appTableRowClass} align-top`}>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/campaigns/${item.id}`}
                        className="font-bold text-[#0f1f4d] hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.code ? (
                        <p className="font-mono text-[11px] text-slate-500">{item.code}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {formatDiscountLabel(
                        item.discountType,
                        item.discountValue,
                        formatMinorToMoney
                      )}
                    </td>
                    <td className="max-w-[180px] px-3 py-3 text-[12px] text-slate-600">
                      {formatCampaignScopeSummary(item.scopes)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{planSummary(item.scopes)}</td>
                    <td className="px-3 py-3 text-slate-700">{intervalSummary(item.scopes)}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.startsAt)}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.endsAt)}</td>
                    <td className="px-3 py-3">
                      {item.usageCount}
                      {item.maxRedemptions != null ? ` / ${item.maxRedemptions}` : ""}
                    </td>
                    <td className="px-3 py-3 text-[12px]">{item.currencies.join(", ")}</td>
                    <td className="px-3 py-3">
                      {item.issues.length ? (
                        <div className="flex flex-wrap gap-1">
                          {item.issues.slice(0, 3).map((issue) => (
                            <span
                              key={issue.code}
                              title={issue.message}
                              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800"
                            >
                              {issue.code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(item.status)}`}
                      >
                        {getCampaignStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <AdminCampaignRowActions campaignId={item.id} status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {items.map((item) => (
              <div key={item.id} className={`${appPanelClass} space-y-3 p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/campaigns/${item.id}`}
                      className="text-[15px] font-extrabold text-[#0f1f4d]"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-[13px] font-bold text-blue-600">
                      {formatDiscountLabel(
                        item.discountType,
                        item.discountValue,
                        formatMinorToMoney
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(item.status)}`}
                  >
                    {getCampaignStatusLabel(item.status)}
                  </span>
                </div>
                <p className="text-[12px] text-slate-600">
                  {formatCampaignScopeSummary(item.scopes)}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <dt className="text-slate-400">Başlangıç</dt>
                    <dd className="font-semibold">{formatAdminDate(item.startsAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Bitiş</dt>
                    <dd className="font-semibold">{formatAdminDate(item.endsAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Kullanım</dt>
                    <dd className="font-semibold">{item.usageCount}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Öncelik</dt>
                    <dd className="font-semibold">{item.priority}</dd>
                  </div>
                </dl>
                <AdminCampaignRowActions campaignId={item.id} status={item.status} />
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
                const params = new URLSearchParams();
                Object.entries(filters).forEach(([key, value]) => {
                  if (value !== undefined && value !== "") params.set(key, String(value));
                });
                params.set("page", String(page));
                return (
                  <Link
                    key={page}
                    href={`/admin/campaigns?${params.toString()}`}
                    className={`rounded-xl px-3 py-1.5 text-[13px] font-bold ${
                      page === pagination.page
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {page}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </AdminPageContainer>
  );
}
