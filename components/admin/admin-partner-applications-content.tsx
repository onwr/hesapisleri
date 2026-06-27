"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
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
import {
  APPLICATION_PAGE_SIZES,
  type ApplicationListFilters,
} from "@/lib/admin/partner-applications/application-types";

type Summary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  last7Days: number;
  stalePending: number;
  matchingPartner: number;
  missingInfo: number;
  duplicateEmailSuspicion: number;
};

type ListItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  audienceTypeLabel: string;
  status: string;
  createdAt: string;
  waitingDays: number | null;
  topIssue: string | null;
};

type ListData = {
  items: ListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function buildHref(filters: ApplicationListFilters, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  params.set("page", String(page));
  return `/admin/partners/applications?${params.toString()}`;
}

export function AdminPartnerApplicationsContent({
  summary,
  list,
  filters,
}: {
  summary: Summary;
  list: ListData;
  filters: ApplicationListFilters;
}) {
  const { items, pagination } = list;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Partner Başvuruları"
        description="Ortaklık başvurularını inceleyin ve sonuçlandırın."
        secondaryActions={
          <Link href="/admin/partners" className={appOutlineButtonClass}>
            Partner listesi
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard title="Toplam" value={String(summary.total)} icon={FileText} tone="blue" />
        <AdminStatCard title="Bekleyen" value={String(summary.pending)} icon={FileText} tone="purple" />
        <AdminStatCard title="Onaylanan" value={String(summary.approved)} icon={FileText} tone="green" />
        <AdminStatCard title="Reddedilen" value={String(summary.rejected)} icon={FileText} tone="blue" />
        <AdminStatCard title="Son 7 gün" value={String(summary.last7Days)} icon={FileText} tone="green" />
        <AdminStatCard title="7+ gün bekleyen" value={String(summary.stalePending)} icon={FileText} tone="purple" />
        <AdminStatCard title="Partner eşleşen" value={String(summary.matchingPartner)} icon={FileText} tone="blue" />
        <AdminStatCard title="Eksik bilgi" value={String(summary.missingInfo)} icon={FileText} tone="purple" />
        <AdminStatCard title="Duplicate e-posta" value={String(summary.duplicateEmailSuspicion)} icon={FileText} tone="green" />
      </div>

      <form className={`${appPanelClass} flex flex-wrap gap-3 p-4`} method="get">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="ID, ad, e-posta, telefon, kullanıcı ID…"
          className="min-w-[200px] flex-1 rounded border px-3 py-2 text-[13px]"
        />
        <select name="status" defaultValue={filters.status ?? ""} className={appSelectClass}>
          <option value="">Tüm durumlar</option>
          <option value="PENDING">Bekleyen</option>
          <option value="APPROVED">Onaylanan</option>
          <option value="REJECTED">Reddedilen</option>
        </select>
        <input
          type="date"
          name="dateFrom"
          defaultValue={filters.dateFrom ?? ""}
          className="rounded border px-3 py-2 text-[13px]"
        />
        <input
          type="date"
          name="dateTo"
          defaultValue={filters.dateTo ?? ""}
          className="rounded border px-3 py-2 text-[13px]"
        />
        <select name="sort" defaultValue={filters.sort ?? "created_desc"} className={appSelectClass}>
          <option value="created_desc">En yeni</option>
          <option value="created_asc">En eski</option>
          <option value="name_asc">Ad A-Z</option>
          <option value="name_desc">Ad Z-A</option>
        </select>
        <select name="pageSize" defaultValue={String(filters.pageSize)} className={appSelectClass}>
          {APPLICATION_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / sayfa
            </option>
          ))}
        </select>
        <button type="submit" className={appPrimaryButtonClass}>
          Filtrele
        </button>
      </form>

      <div className={`${appPanelClass} overflow-x-auto p-4`}>
        {items.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-slate-500">Başvuru bulunamadı.</p>
        ) : (
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Başvuran</th>
                <th className="px-3 py-2">İletişim</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Bekleme</th>
                <th className="px-3 py-2">Issue</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <p className="font-bold text-[#0f1f4d]">{item.fullName}</p>
                    <p className="text-[11px] text-slate-400">{item.audienceTypeLabel}</p>
                  </td>
                  <td className="px-3 py-3 text-[12px]">
                    <p>{item.email}</p>
                    <p className="text-slate-500">{item.phone ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-[12px]">{formatAdminDate(item.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px]">
                    {item.waitingDays != null ? `${item.waitingDays} gün` : "—"}
                  </td>
                  <td className="px-3 py-3 text-[11px] font-mono text-amber-800">
                    {item.topIssue ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/partners/applications/${item.id}`}
                      className="text-[12px] font-bold text-blue-700 hover:underline"
                    >
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-slate-500">
              Sayfa {pagination.page} / {pagination.totalPages} · {pagination.total} kayıt
            </span>
            <div className="flex gap-2">
              {pagination.page > 1 ? (
                <Link href={buildHref(filters, pagination.page - 1)} className={appOutlineButtonClass}>
                  Önceki
                </Link>
              ) : null}
              {pagination.page < pagination.totalPages ? (
                <Link href={buildHref(filters, pagination.page + 1)} className={appOutlineButtonClass}>
                  Sonraki
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AdminPageContainer>
  );
}
