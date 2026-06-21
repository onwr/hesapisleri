"use client";

import Link from "next/link";
import { Boxes, Package } from "lucide-react";
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
import type { AddOnListFilters } from "@/lib/admin/addons/addon-types";
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

export function AdminMembershipAddonsContent({
  list,
  summary,
  filters,
}: {
  list: ListData;
  summary: SummaryData;
  filters: AddOnListFilters;
}) {
  const { items, pagination } = list;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Ek Paketler"
        description="Üyelik planlarına ek kapasite, kullanım hakkı ve özellik paketleri tanımlayın."
        primaryAction={
          <Link href="/admin/membership-addons/new" className={appPrimaryButtonClass}>
            Yeni Ek Paket
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AdminStatCard title="Toplam Paket" value={summary.total} icon={Boxes} />
        <AdminStatCard title="Aktif" value={summary.active} icon={Package} />
        <AdminStatCard title="Yinelenen" value={summary.recurring} icon={Package} />
        <AdminStatCard title="Tek Seferlik" value={summary.oneTime} icon={Package} />
        <AdminStatCard title="Kullanım Paketi" value={summary.usagePack} icon={Package} />
        <AdminStatCard title="Aktif Firma Paketi" value={summary.activeCompanySubs} icon={Boxes} />
      </div>

      <div className={`${appPanelClass} mb-4 p-4`}>
        <form className="flex flex-wrap gap-3" method="get">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Ara..."
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={filters.status ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tüm Durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DRAFT">Taslak</option>
            <option value="ARCHIVED">Arşiv</option>
          </select>
          <select name="type" defaultValue={filters.type ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tüm Türler</option>
            <option value="RECURRING">Yinelenen</option>
            <option value="ONE_TIME">Tek Seferlik</option>
            <option value="USAGE_PACK">Kullanım Paketi</option>
          </select>
          <button type="submit" className={appOutlineButtonClass}>
            Filtrele
          </button>
        </form>
      </div>

      <div className={`${appPanelClass} hidden overflow-x-auto md:block`}>
        <table className={appTableClass}>
          <thead className={appTableHeadClass}>
            <tr>
              <th>Paket</th>
              <th>Tür</th>
              <th>Sağladığı Hak</th>
              <th>Miktar</th>
              <th>Fiyatlar</th>
              <th>Aktif Firma</th>
              <th>Durum</th>
              <th>Son Güncelleme</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={appTableRowClass}>
                <td>
                  <p className="font-bold text-[#0f1f4d]">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.code}</p>
                </td>
                <td>{TYPE_LABELS[item.type] ?? item.type}</td>
                <td>{item.entitlementLabel}</td>
                <td>{item.entitlementQuantity}</td>
                <td>
                  {item.prices[0]
                    ? formatMinorToMoney(item.prices[0].salePriceMinor, item.prices[0].currency)
                    : "—"}
                </td>
                <td>{item.activeCompanyCount}</td>
                <td>{STATUS_LABELS[item.status] ?? item.status}</td>
                <td>{formatAdminDate(item.updatedAt)}</td>
                <td>
                  <Link href={`/admin/membership-addons/${item.id}`} className="text-sm font-semibold text-blue-600">
                    Görüntüle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div key={item.id} className={`${appPanelClass} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-[#0f1f4d]">{item.name}</p>
                <p className="text-xs text-slate-500">{TYPE_LABELS[item.type]}</p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {item.entitlementLabel} · +{item.entitlementQuantity}
            </p>
            <Link
              href={`/admin/membership-addons/${item.id}`}
              className="mt-3 inline-block text-sm font-semibold text-blue-600"
            >
              Detay
            </Link>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={`/admin/membership-addons?page=${page}`}
              className={`rounded-lg px-3 py-1 text-sm ${
                page === pagination.page ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
