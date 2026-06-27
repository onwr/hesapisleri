"use client";

import Link from "next/link";
import { Archive, Boxes, Package, PlayCircle } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type { AddOnListFilters } from "@/lib/admin/addons/addon-types";
import { ADDON_PAGE_SIZES } from "@/lib/admin/addons/addon-types";
import type { getAddOnSummary, listAddOns } from "@/lib/admin/addons/addon-query-service";

type ListData = Awaited<ReturnType<typeof listAddOns>>;
type SummaryData = Awaited<ReturnType<typeof getAddOnSummary>>;

const TYPE_LABELS: Record<string, string> = {
  RECURRING: "Yinelenen",
  ONE_TIME: "Tek Seferlik",
  USAGE_PACK: "Kullanım Paketi",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  ARCHIVED: "Arşiv",
};

function buildPageHref(filters: AddOnListFilters, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  params.set("page", String(page));
  return `/admin/add-ons?${params.toString()}`;
}

export function AdminMembershipAddonsContent({
  list,
  summary,
  filters,
  activeFilterCount,
  entitlements = [],
}: {
  list: ListData;
  summary: SummaryData;
  filters: AddOnListFilters;
  activeFilterCount: number;
  entitlements?: Array<{ code: string; label: string }>;
}) {
  const { items, pagination } = list;
  const hasFilters = activeFilterCount > 0 || Boolean(filters.q?.trim());

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Ek Paketler"
        description="Üyelik planlarına ek kapasite, kullanım hakkı ve özellik paketleri."
        primaryAction={
          <Link href="/admin/add-ons/new" className={appPrimaryButtonClass}>
            Yeni Ek Paket
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard title="Toplam" value={String(summary.total)} icon={Boxes} tone="blue" />
        <AdminStatCard title="Taslak" value={String(summary.draft)} icon={Package} tone="purple" />
        <AdminStatCard title="Aktif" value={String(summary.active)} icon={PlayCircle} tone="green" />
        <AdminStatCard title="Arşiv" value={String(summary.archived)} icon={Archive} tone="blue" />
        <AdminStatCard title="Ücretsiz" value={String(summary.free)} icon={Package} tone="green" />
        <AdminStatCard title="Ücretli" value={String(summary.paid)} icon={Package} tone="amber" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard title="Aktif Abonelikli" value={String(summary.withActiveSubs)} icon={Boxes} tone="green" />
        <AdminStatCard title="Hiç Kullanılmayan" value={String(summary.neverUsed)} icon={Package} tone="purple" />
        <AdminStatCard title="Fiyat Eksik" value={String(summary.missingPrice)} icon={Archive} tone="red" />
        <AdminStatCard title="Entitlement Sorunu" value={String(summary.entitlementIssues)} icon={Package} tone="amber" />
        <AdminStatCard title="Yakında Fiyat" value={String(summary.upcomingPrice)} icon={PlayCircle} tone="amber" />
      </div>

      <div className={`${appPanelClass} mb-4 p-4`}>
        <form className="flex flex-wrap gap-3" method="get" action="/admin/add-ons">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Ad, kod veya açıklama ara…"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={filters.status ?? ""} className={appSelectClass}>
            <option value="">Tüm durumlar</option>
            <option value="DRAFT">Taslak</option>
            <option value="ACTIVE">Aktif</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
          <select name="type" defaultValue={filters.type ?? ""} className={appSelectClass}>
            <option value="">Tüm türler</option>
            <option value="RECURRING">Yinelenen</option>
            <option value="ONE_TIME">Tek seferlik</option>
            <option value="USAGE_PACK">Kullanım paketi</option>
          </select>
          {entitlements.length ? (
            <select
              name="entitlementCode"
              defaultValue={filters.entitlementCode ?? ""}
              className={appSelectClass}
            >
              <option value="">Tüm entitlement</option>
              {entitlements.map((e) => (
                <option key={e.code} value={e.code}>
                  {e.label}
                </option>
              ))}
            </select>
          ) : null}
          <button type="submit" className={appOutlineButtonClass}>
            Filtrele
          </button>
          {hasFilters ? (
            <Link href="/admin/add-ons" className={appOutlineButtonClass}>
              Temizle
            </Link>
          ) : null}
        </form>
      </div>

      {items.length === 0 ? (
        <div className={`${appPanelClass} px-6 py-16 text-center`}>
          <p className="text-[15px] font-bold text-[#0f1f4d]">
            {hasFilters ? "Eşleşen ek paket bulunamadı." : "Henüz ek paket yok."}
          </p>
        </div>
      ) : (
        <>
          <div className={`${appPanelClass} hidden overflow-x-auto md:block`}>
            <table className={appTableClass}>
              <thead className={appTableHeadClass}>
                <tr>
                  <th>Ad / Kod</th>
                  <th>Durum</th>
                  <th>Tür</th>
                  <th>Fiyatlar</th>
                  <th>PB</th>
                  <th>Entitlement</th>
                  <th>Aktif Abonelik</th>
                  <th>Sorun</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={appTableRowClass}>
                    <td>
                      <p className="font-bold text-[#0f1f4d]">{item.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{item.code}</p>
                    </td>
                    <td>{STATUS_LABELS[item.status] ?? item.status}</td>
                    <td>{TYPE_LABELS[item.type] ?? item.type}</td>
                    <td className="text-[12px]">
                      {item.prices.length
                        ? item.prices
                            .map((p) =>
                              formatMinorToMoney(p.salePriceMinor, p.currency)
                            )
                            .join(" · ")
                        : "—"}
                    </td>
                    <td>{item.currency}</td>
                    <td className="text-[12px]">
                      {item.entitlementLabel} (+{item.entitlementQuantity})
                    </td>
                    <td>{item.activeCompanyCount}</td>
                    <td>
                      {item.issues[0] ? (
                        <span className="text-[11px] font-bold text-amber-800">
                          {item.issues[0].code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/add-ons/${item.id}`}
                        className={appPrimaryButtonClass + " !px-3 !py-1.5 !text-[12px]"}
                      >
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {pagination.totalPages > 1 ? (
              <div className="flex gap-2">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <Link
                    key={page}
                    href={buildPageHref(filters, page)}
                    className={`rounded-xl px-3 py-1.5 text-[13px] font-bold ${
                      page === pagination.page
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {page}
                  </Link>
                ))}
              </div>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <span>Sayfa başına:</span>
              {ADDON_PAGE_SIZES.map((size) => (
                <Link
                  key={size}
                  href={buildPageHref({ ...filters, pageSize: size, page: 1 }, 1)}
                  className={`rounded-lg px-2 py-1 font-bold ${
                    (filters.pageSize ?? pagination.pageSize) === size
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </AdminPageContainer>
  );
}
