"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";
import {
  SYSTEM_LOG_PAGE_SIZES,
  buildSystemLogQueryString,
  type SystemLogListFilters,
} from "@/lib/admin/system-logs/system-log-types";

type ListItem = {
  id: string;
  createdAt: string;
  action: string;
  module: string;
  actor: { id: string; name: string | null; email: string } | null;
  company: { id: string; name: string } | null;
  entityType: string | null;
  entityIdShort: string | null;
  entityHref: string | null;
  source: string;
  result: string;
  scope: "structured" | "legacy";
  summary: string;
};

type Metric = {
  key: string;
  label: string;
  count: number;
  filter: Record<string, string>;
};

type Props = {
  list: {
    items: ListItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
  metrics: Metric[];
  filters: SystemLogListFilters;
  modules: string[];
  actions: string[];
};

const SOURCE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TENANT: "Tenant",
  SYSTEM: "Sistem",
  CRON: "Cron",
};

const RESULT_LABELS: Record<string, string> = {
  success: "Başarılı",
  error: "Hata",
  unknown: "—",
};

function resultClass(result: string) {
  if (result === "error") return "bg-rose-100 text-rose-700";
  if (result === "success") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

function sourceClass(source: string) {
  if (source === "ADMIN") return "bg-slate-900 text-white";
  if (source === "TENANT") return "bg-blue-100 text-blue-700";
  if (source === "CRON") return "bg-violet-100 text-violet-700";
  return "bg-slate-100 text-slate-700";
}

function buildHref(filters: Partial<SystemLogListFilters>, page?: number) {
  const q = buildSystemLogQueryString({ ...filters, ...(page ? { page } : {}) });
  return q ? `/admin/system-logs?${q}` : "/admin/system-logs";
}

export function AdminSystemLogsContent({ list, metrics, filters, modules, actions }: Props) {
  const { items, pagination } = list;

  const exportHref = useMemo(() => {
    const q = buildSystemLogQueryString(filters);
    return q ? `/api/admin/system-logs/export?${q}` : "/api/admin/system-logs/export";
  }, [filters]);

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Sistem Logları"
        description="Platform aktivite ve audit kayıtları (salt okunur)."
        secondaryActions={
          <a href={exportHref} className={appOutlineButtonClass}>
            CSV Dışa Aktar
          </a>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {metrics.map((m) => (
          <Link
            key={m.key}
            href={buildHref({ ...filters, ...m.filter, page: 1 })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-blue-300"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{m.label}</p>
            <p className="text-[15px] font-bold text-slate-800">{m.count}</p>
          </Link>
        ))}
      </div>

      <div className={`${appPanelClass} p-4`}>
        <form action="/admin/system-logs" method="get" className="mb-4 grid gap-2 lg:grid-cols-4 xl:grid-cols-6">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Ara (min 2 karakter)…"
            className={appInputClass}
          />
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            className={appInputClass}
            title="Başlangıç"
          />
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            className={appInputClass}
            title="Bitiş"
          />
          <select name="module" defaultValue={filters.module ?? "ALL"} className={appSelectClass}>
            <option value="ALL">Tüm modüller</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select name="action" defaultValue={filters.action ?? "ALL"} className={appSelectClass}>
            <option value="ALL">Tüm aksiyonlar</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select name="entityType" defaultValue={filters.entityType ?? "ALL"} className={appSelectClass}>
            <option value="ALL">Tüm entity tipleri</option>
            <option value="MembershipPlan">MembershipPlan</option>
            <option value="MembershipPayment">MembershipPayment</option>
            <option value="CompanySubscription">CompanySubscription</option>
            <option value="Company">Company</option>
            <option value="User">User</option>
            <option value="PartnerProfile">PartnerProfile</option>
            <option value="PartnerApplication">PartnerApplication</option>
            <option value="PartnerPayout">PartnerPayout</option>
            <option value="MembershipCampaign">MembershipCampaign</option>
            <option value="MembershipCoupon">MembershipCoupon</option>
            <option value="MembershipAddOn">MembershipAddOn</option>
          </select>
          <select name="source" defaultValue={filters.source ?? ""} className={appSelectClass}>
            <option value="">Tüm kaynaklar</option>
            <option value="ADMIN">Admin</option>
            <option value="TENANT">Tenant</option>
            <option value="SYSTEM">Sistem</option>
            <option value="CRON">Cron</option>
          </select>
          <select name="result" defaultValue={filters.result ?? ""} className={appSelectClass}>
            <option value="">Tüm sonuçlar</option>
            <option value="success">Başarılı</option>
            <option value="error">Hata</option>
            <option value="unknown">Belirsiz</option>
          </select>
          <select name="scope" defaultValue={filters.scope ?? ""} className={appSelectClass}>
            <option value="">Structured + legacy</option>
            <option value="structured">Structured</option>
            <option value="legacy">Legacy</option>
          </select>
          <select name="sort" defaultValue={filters.sort} className={appSelectClass}>
            <option value="created_desc">Tarih ↓</option>
            <option value="created_asc">Tarih ↑</option>
            <option value="action_asc">Aksiyon A-Z</option>
            <option value="module_asc">Modül A-Z</option>
          </select>
          <select name="pageSize" defaultValue={String(filters.pageSize)} className={appSelectClass}>
            {SYSTEM_LOG_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / sayfa
              </option>
            ))}
          </select>
          <button type="submit" className={appPrimaryButtonClass}>
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Aksiyon</th>
                <th className="px-3 py-2">Modül</th>
                <th className="px-3 py-2">Aktör</th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Kaynak</th>
                <th className="px-3 py-2">Sonuç</th>
                <th className="px-3 py-2">Özet</th>
                <th className="px-3 py-2">Detay</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[13px] text-slate-500">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id} className={appTableRowClass}>
                    <td className="px-3 py-2 text-[12px] text-slate-500 whitespace-nowrap">
                      {formatAdminDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">{log.action}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{log.module}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {log.actor ? (
                        <Link href={`/admin/users/${log.actor.id}`} className="text-blue-700 hover:underline">
                          {log.actor.name ?? log.actor.email}
                        </Link>
                      ) : (
                        "Sistem"
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {log.company ? (
                        <Link href={`/admin/companies/${log.company.id}`} className="text-blue-700 hover:underline">
                          {log.company.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {log.scope === "legacy" ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                          legacy
                        </span>
                      ) : log.entityType ? (
                        <span>
                          {log.entityType}
                          {log.entityIdShort ? (
                            <>
                              {" "}
                              <span className="font-mono text-slate-500">{log.entityIdShort}</span>
                            </>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sourceClass(log.source)}`}
                      >
                        {SOURCE_LABELS[log.source] ?? log.source}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${resultClass(log.result)}`}
                      >
                        {RESULT_LABELS[log.result] ?? log.result}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[12px] text-slate-700">
                      {log.summary || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/system-logs/${log.id}`}
                        className="text-[12px] font-bold text-blue-700 hover:underline"
                      >
                        Görüntüle
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-[12px] text-slate-500">
          <span>
            Toplam {pagination.total} kayıt · Sayfa {pagination.page}/{pagination.totalPages}
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Link
                href={buildHref(filters, pagination.page - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Önceki
              </Link>
            ) : null}
            {pagination.page < pagination.totalPages ? (
              <Link
                href={buildHref(filters, pagination.page + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
              >
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}
