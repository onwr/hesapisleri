"use client";

import Link from "next/link";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { AdminPartnerPayoutCreateModal } from "@/components/admin/admin-partner-payout-create-modal";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { AdminStatCard } from "@/components/admin/layout/admin-stat-card";
import {
  appOutlineButtonClass,
  appPanelClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";
import {
  PAYOUT_PAGE_SIZES,
  type PayoutListFilters,
} from "@/lib/admin/partner-payouts/payout-types";

type CurrencyMap = Record<string, { count: number; amount: number }>;

type Summary = {
  total: CurrencyMap;
  draft: CurrencyMap;
  pending: CurrencyMap;
  paid: CurrencyMap;
  cancelled: CurrencyMap;
  paidThisMonth: CurrencyMap;
  pendingTotal: CurrencyMap;
  paymentProfileMissing: number;
  totalMismatch: number;
  count: number;
};

type ListItem = {
  id: string;
  partnerId: string;
  partnerName: string;
  referralCode: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentReferenceMasked: string | null;
  paidBy: { id: string; name: string | null; email: string } | null;
  earningCount: number;
  paidAt: string | null;
  createdAt: string;
  topIssue: { code: string; message: string } | null;
  hasIssue: boolean;
};

type PartnerOption = {
  id: string;
  fullName: string;
  referralCode: string;
  status: string;
};

type ListData = {
  items: ListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function formatCurrencyTotals(map: CurrencyMap): string {
  const entries = Object.entries(map);
  if (!entries.length) return "—";
  return entries
    .map(([cur, v]) => `${formatAdminMoney(v.amount)} ${cur} (${v.count})`)
    .join(" · ");
}

function statusClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDING") return "bg-amber-100 text-amber-700";
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function buildHref(filters: PayoutListFilters, page: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  params.set("page", String(page));
  return `/admin/partners/payouts?${params.toString()}`;
}

export function AdminPartnerPayoutsContent({
  summary,
  list,
  filters,
  partners,
  minimumPayoutAmount,
}: {
  summary: Summary;
  list: ListData;
  filters: PayoutListFilters;
  partners: PartnerOption[];
  minimumPayoutAmount: number;
}) {
  const { items, pagination } = list;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Partner Ödemeleri"
        description="Partner hak ediş ödemelerini yönetin."
        secondaryActions={
          <>
            <button type="button" className={appOutlineButtonClass} onClick={() => setCreateOpen(true)}>
              Payout Oluştur
            </button>
            <Link href="/admin/partners" className={appOutlineButtonClass}>
              Partner listesi
            </Link>
          </>
        }
      />

      {createOpen ? (
        <AdminPartnerPayoutCreateModal
          partners={partners}
          minimumPayoutAmount={minimumPayoutAmount}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard title="Toplam" value={formatCurrencyTotals(summary.total)} icon={Wallet} tone="blue" />
        <AdminStatCard title="Taslak" value={formatCurrencyTotals(summary.draft)} icon={Wallet} tone="purple" />
        <AdminStatCard title="Bekleyen" value={formatCurrencyTotals(summary.pending)} icon={Wallet} tone="amber" />
        <AdminStatCard title="Ödenen" value={formatCurrencyTotals(summary.paid)} icon={Wallet} tone="green" />
        <AdminStatCard title="İptal" value={formatCurrencyTotals(summary.cancelled)} icon={Wallet} tone="blue" />
        <AdminStatCard title="Bu ay ödenen" value={formatCurrencyTotals(summary.paidThisMonth)} icon={Wallet} tone="green" />
        <AdminStatCard title="Bekleyen toplam" value={formatCurrencyTotals(summary.pendingTotal)} icon={Wallet} tone="purple" />
        <AdminStatCard title="Profil eksik" value={String(summary.paymentProfileMissing)} icon={Wallet} tone="amber" />
        <AdminStatCard title="Tutar uyuşmazlığı" value={String(summary.totalMismatch)} icon={Wallet} tone="blue" />
      </div>

      <form className={`${appPanelClass} flex flex-wrap gap-3 p-4`} method="get">
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="ID, partner, e-posta, kod…"
          className="min-w-[200px] flex-1 rounded border px-3 py-2 text-[13px]"
        />
        <select name="status" defaultValue={filters.status ?? ""} className={appSelectClass}>
          <option value="">Tüm durumlar</option>
          <option value="DRAFT">Taslak</option>
          <option value="PENDING">Bekleyen</option>
          <option value="PAID">Ödenen</option>
          <option value="CANCELLED">İptal</option>
        </select>
        <input
          name="currency"
          defaultValue={filters.currency ?? ""}
          placeholder="Para birimi"
          className="w-24 rounded border px-3 py-2 text-[13px]"
        />
        <input type="date" name="periodFrom" defaultValue={filters.periodFrom ?? ""} className="rounded border px-3 py-2 text-[13px]" />
        <input type="date" name="periodTo" defaultValue={filters.periodTo ?? ""} className="rounded border px-3 py-2 text-[13px]" />
        <input type="date" name="paidFrom" defaultValue={filters.paidFrom ?? ""} className="rounded border px-3 py-2 text-[13px]" />
        <input type="date" name="paidTo" defaultValue={filters.paidTo ?? ""} className="rounded border px-3 py-2 text-[13px]" />
        <select name="hasIssue" defaultValue={filters.hasIssue === true ? "1" : filters.hasIssue === false ? "0" : ""} className={appSelectClass}>
          <option value="">Tüm kayıtlar</option>
          <option value="1">Sorunlu</option>
          <option value="0">Sorunsuz</option>
        </select>
        <select name="sort" defaultValue={filters.sort ?? "created_desc"} className={appSelectClass}>
          <option value="created_desc">En yeni</option>
          <option value="created_asc">En eski</option>
          <option value="amount_desc">Tutar ↓</option>
          <option value="amount_asc">Tutar ↑</option>
          <option value="paid_desc">Ödeme tarihi</option>
        </select>
        <select name="pageSize" defaultValue={String(filters.pageSize)} className={appSelectClass}>
          {PAYOUT_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}/sayfa
            </option>
          ))}
        </select>
        <button type="submit" className={appOutlineButtonClass}>
          Filtrele
        </button>
      </form>

      <div className={appPanelClass}>
        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Hak ediş</th>
                <th className="px-3 py-2">Yöntem</th>
                <th className="px-3 py-2">Oluşturma</th>
                <th className="px-3 py-2">Referans</th>
                <th className="px-3 py-2">Ödeyen</th>
                <th className="px-3 py-2">Ödeme</th>
                <th className="px-3 py-2">Sorun</th>
              </tr>
            </thead>
            <tbody>
              {items.map((payout) => (
                <tr key={payout.id} className={appTableRowClass}>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/partners/payouts/${payout.id}`}
                      className="font-bold text-slate-800 hover:underline"
                    >
                      {payout.partnerName}
                    </Link>
                    <p className="font-mono text-[11px] text-slate-500">{payout.referralCode}</p>
                  </td>
                  <td className="px-3 py-3">
                    {formatAdminMoney(payout.amount)} {payout.currency}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${statusClass(payout.status)}`}>
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{payout.earningCount}</td>
                  <td className="px-3 py-3">{payout.paymentMethod}</td>
                  <td className="px-3 py-3">{formatAdminDate(payout.createdAt)}</td>
                  <td className="px-3 py-3 font-mono text-[11px]">{payout.paymentReferenceMasked ?? "—"}</td>
                  <td className="px-3 py-3 text-[12px]">{payout.paidBy?.name ?? payout.paidBy?.email ?? "—"}</td>
                  <td className="px-3 py-3">{payout.paidAt ? formatAdminDate(payout.paidAt) : "—"}</td>
                  <td className="px-3 py-3 text-[12px] text-amber-700">
                    {payout.topIssue?.message ?? "—"}
                  </td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              {pagination.total} kayıt · sayfa {pagination.page}/{pagination.totalPages}
            </p>
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
