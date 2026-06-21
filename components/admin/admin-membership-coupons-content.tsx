"use client";

import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { AdminCouponFilters } from "@/components/admin/promotions/admin-coupon-filters";
import { AdminCouponCopyButton, AdminCouponRowActions } from "@/components/admin/admin-coupon-row-actions";
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
import type { CouponListFilters } from "@/lib/admin/promotions/promotion-types";
import {
  formatCouponIntervalSummary,
  formatCouponPlanSummary,
  formatDiscountLabel,
} from "@/lib/admin/promotions/promotion-scope-utils";
import {
  getCampaignStatusBadgeClass,
  getCouponStatusLabel,
} from "@/lib/admin/promotions/promotion-filter-utils";
import type { getCouponSummary, listCoupons } from "@/lib/admin/promotions/coupon-query-service";

type ListData = Awaited<ReturnType<typeof listCoupons>>;
type SummaryData = Awaited<ReturnType<typeof getCouponSummary>>;
type Plan = { id: string; name: string };

export function AdminMembershipCouponsContent({
  list,
  summary,
  filters,
  plans,
  activeFilterCount,
}: {
  list: ListData;
  summary: SummaryData;
  filters: CouponListFilters;
  plans: Plan[];
  activeFilterCount: number;
}) {
  const { items, pagination } = list;
  const hasFilters = activeFilterCount > 0 || Boolean(filters.q?.trim());

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Kuponlar"
        description="Üyelik ödemelerinde kullanılacak indirim kodlarını yönetin."
        primaryAction={
          <Link href="/admin/membership-coupons/new" className={appPrimaryButtonClass}>
            Yeni Kupon
          </Link>
        }
        secondaryActions={
          <Link href="/admin/membership-coupons/bulk" className={appOutlineButtonClass}>
            Toplu Kupon Oluştur
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard title="Toplam Kupon" value={String(summary.total)} icon={TicketPercent} tone="blue" />
        <AdminStatCard title="Aktif" value={String(summary.active)} icon={TicketPercent} tone="green" />
        <AdminStatCard title="Bu Ay Kullanılan" value={String(summary.monthlyUsage)} icon={TicketPercent} tone="purple" />
        <AdminStatCard title="Limit Dolan" value={String(summary.limitReached)} icon={TicketPercent} tone="red" />
        <AdminStatCard title="Yakında Bitecek" value={String(summary.endingSoon)} icon={TicketPercent} tone="amber" />
        <AdminStatCard
          title="Toplam İndirim"
          value={formatMinorToMoney(summary.totalDiscountMinor)}
          icon={TicketPercent}
          tone="blue"
        />
      </div>

      <AdminCouponFilters filters={filters} plans={plans} activeFilterCount={activeFilterCount} />

      {items.length === 0 ? (
        <div className={`${appPanelClass} px-6 py-16 text-center`}>
          <p className="text-[15px] font-bold text-[#0f1f4d]">
            {hasFilters
              ? "Aramanızla eşleşen kupon bulunamadı."
              : "Henüz kupon oluşturulmamış."}
          </p>
          <p className="mt-1 text-[13px] text-slate-500">
            {hasFilters
              ? "Filtreleri temizleyerek tekrar deneyin."
              : "Yeni kupon veya toplu kupon oluşturarak başlayın."}
          </p>
        </div>
      ) : (
        <>
          <div className={`${appPanelClass} hidden overflow-x-auto p-4 md:block`}>
            <table className={appTableClass}>
              <thead>
                <tr className={appTableHeadClass}>
                  <th className="px-3 py-2">Kod</th>
                  <th className="px-3 py-2">İsim</th>
                  <th className="px-3 py-2">İndirim</th>
                  <th className="px-3 py-2">Planlar</th>
                  <th className="px-3 py-2">Dönemler</th>
                  <th className="px-3 py-2">Kullanım</th>
                  <th className="px-3 py-2">Firma Limiti</th>
                  <th className="px-3 py-2">Başlangıç</th>
                  <th className="px-3 py-2">Bitiş</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`${appTableRowClass} align-top`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold">{item.code}</span>
                        <AdminCouponCopyButton code={item.code} />
                      </div>
                    </td>
                    <td className="px-3 py-3">{item.name}</td>
                    <td className="px-3 py-3">
                      {formatDiscountLabel(
                        item.discountType,
                        item.discountValue,
                        formatMinorToMoney
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {formatCouponPlanSummary(item.planScopes)}
                    </td>
                    <td className="px-3 py-3">
                      {formatCouponIntervalSummary(item.allowedIntervals)}
                    </td>
                    <td className="px-3 py-3">
                      {item.usageCount}
                      {item.maxUsage ? ` / ${item.maxUsage}` : ""}
                    </td>
                    <td className="px-3 py-3">{item.maxUsagePerCompany}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.startsAt)}</td>
                    <td className="px-3 py-3">{formatAdminDate(item.expiresAt)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(item.status)}`}
                      >
                        {getCouponStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <AdminCouponRowActions
                        couponId={item.id}
                        status={item.status}
                        code={item.code}
                      />
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px] font-extrabold text-[#0f1f4d]">
                        {item.code}
                      </span>
                      <AdminCouponCopyButton code={item.code} />
                    </div>
                    <p className="mt-1 text-[13px] text-slate-600">{item.name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${getCampaignStatusBadgeClass(item.status)}`}
                  >
                    {getCouponStatusLabel(item.status)}
                  </span>
                </div>
                <p className="text-[13px] font-bold text-blue-600">
                  {formatDiscountLabel(
                    item.discountType,
                    item.discountValue,
                    formatMinorToMoney
                  )}
                </p>
                <p className="text-[12px] text-slate-600">
                  {formatCouponPlanSummary(item.planScopes)} ·{" "}
                  {formatCouponIntervalSummary(item.allowedIntervals)}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <dt className="text-slate-400">Kullanım</dt>
                    <dd className="font-semibold">
                      {item.usageCount}
                      {item.maxUsage ? ` / ${item.maxUsage}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Bitiş</dt>
                    <dd className="font-semibold">{formatAdminDate(item.expiresAt)}</dd>
                  </div>
                </dl>
                <AdminCouponRowActions
                  couponId={item.id}
                  status={item.status}
                  code={item.code}
                />
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
                    href={`/admin/membership-coupons?${params.toString()}`}
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
