"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
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
import type { PartnerListFilters } from "@/lib/admin/partners/partner-types";
import { PARTNER_PAGE_SIZES } from "@/lib/admin/partners/partner-types";
import type { getPartnerSummary, listPartners } from "@/lib/admin/partners";

type ListData = Awaited<ReturnType<typeof listPartners>>;
type SummaryData = Awaited<ReturnType<typeof getPartnerSummary>>;

function buildHref(filters: PartnerListFilters, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  params.set("page", String(page));
  return `/admin/partners?${params.toString()}`;
}

export function AdminPartnersContent({
  list,
  summary,
  filters,
}: {
  list: ListData;
  summary: SummaryData;
  filters: PartnerListFilters;
}) {
  const { items, pagination } = list;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Partnerler"
        description="Bayi ve referral partner yönetimi."
        primaryAction={
          <Link href="/admin/partners/new" className={appPrimaryButtonClass}>
            Yeni Partner
          </Link>
        }
        secondaryActions={
          <Link href="/admin/partners/applications" className={appOutlineButtonClass}>
            Başvurular
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard title="Toplam" value={String(summary.total)} icon={Handshake} tone="blue" />
        <AdminStatCard title="Aktif" value={String(summary.active)} icon={Handshake} tone="green" />
        <AdminStatCard title="Pasif/Askıda" value={String(summary.passiveSuspended)} icon={Handshake} tone="purple" />
        <AdminStatCard title="Arşiv" value={String(summary.archived)} icon={Handshake} tone="blue" />
        <AdminStatCard title="Firmalı" value={String(summary.withCompanies)} icon={Handshake} tone="green" />
        <AdminStatCard title="Firmasız" value={String(summary.withoutCompanies)} icon={Handshake} tone="purple" />
        <AdminStatCard title="Bu ay yeni firma" value={String(summary.newCompaniesThisMonth)} icon={Handshake} tone="blue" />
        <AdminStatCard title="Komisyon eksik" value={String(summary.missingCommissionConfig)} icon={Handshake} tone="purple" />
      </div>

      <form className={`${appPanelClass} flex flex-wrap gap-3 p-4`} method="get">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Ara…"
          className="min-w-[200px] flex-1 rounded border px-3 py-2 text-[13px]"
        />
        <select name="status" defaultValue={filters.status ?? ""} className={appSelectClass}>
          <option value="">Tüm durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
          <option value="SUSPENDED">Askıda</option>
          <option value="ARCHIVED">Arşiv</option>
        </select>
        <select name="hasCompanies" defaultValue={filters.hasCompanies ?? ""} className={appSelectClass}>
          <option value="">Tüm firmalar</option>
          <option value="true">Firması olan</option>
          <option value="false">Firması olmayan</option>
        </select>
        <select name="pageSize" defaultValue={String(filters.pageSize)} className={appSelectClass}>
          {PARTNER_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s} / sayfa
            </option>
          ))}
        </select>
        <button type="submit" className={appPrimaryButtonClass}>
          Filtrele
        </button>
      </form>

      <div className={`${appPanelClass} overflow-x-auto`}>
        <table className={appTableClass}>
          <thead>
            <tr className={appTableHeadClass}>
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Kod</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Firma</th>
              <th className="px-3 py-2">Aktif abn.</th>
              <th className="px-3 py-2">Komisyon</th>
              <th className="px-3 py-2">Sorun</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-slate-500">
                  Partner bulunamadı.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <p className="font-bold">{p.fullName}</p>
                    <p className="text-[12px] text-slate-400">{p.email}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px]">{p.referralCode}</td>
                  <td className="px-3 py-3">{p.status}</td>
                  <td className="px-3 py-3">{p.companyCount}</td>
                  <td className="px-3 py-3">{p.activeSubscriptionCompanies}</td>
                  <td className="px-3 py-3">{p.commissionSummary}</td>
                  <td className="px-3 py-3">
                    {p.primaryIssue ? (
                      <span className="text-[11px] font-bold text-amber-800">{p.primaryIssue.code}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/partners/${p.id}`} className="font-bold text-blue-700 hover:underline">
                      Detay
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          {pagination.page > 1 ? (
            <Link href={buildHref(filters, pagination.page - 1)} className={appOutlineButtonClass}>
              Önceki
            </Link>
          ) : null}
          <span className="px-3 py-2 text-[13px] text-slate-500">
            {pagination.page} / {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages ? (
            <Link href={buildHref(filters, pagination.page + 1)} className={appOutlineButtonClass}>
              Sonraki
            </Link>
          ) : null}
        </div>
      ) : null}
    </AdminPageContainer>
  );
}
