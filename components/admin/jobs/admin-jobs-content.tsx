"use client";

import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";
import type { JobListFilters } from "@/lib/admin/jobs/job-query-service";

type JobItem = {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  scheduleHint: string;
  currentStatus: string;
  isOverdue: boolean;
  isRunning: boolean;
  manualRunSupported: boolean;
  lastRun: { startedAt: string | null; durationMs: number | null; status: string } | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

type Props = {
  data: {
    items: JobItem[];
    metrics: {
      total: number;
      healthy: number;
      overdue: number;
      running: number;
      failed: number;
      neverRun: number;
      failuresLast24h: number;
    };
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  };
  filters: JobListFilters;
};

const STATUS_LABELS: Record<string, string> = {
  HEALTHY: "Sağlıklı",
  OVERDUE: "Gecikmiş",
  RUNNING: "Çalışıyor",
  FAILED: "Başarısız",
  NEVER_RUN: "Hiç çalışmadı",
  UNKNOWN: "Bilinmiyor",
};

function statusClass(status: string) {
  if (status === "HEALTHY") return "bg-emerald-100 text-emerald-800";
  if (status === "OVERDUE") return "bg-amber-100 text-amber-800";
  if (status === "RUNNING") return "bg-blue-100 text-blue-800";
  if (status === "FAILED") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function buildHref(filters: JobListFilters, page?: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  params.set("pageSize", String(filters.pageSize));
  params.set("page", String(page ?? filters.page));
  return `/admin/jobs?${params.toString()}`;
}

export function AdminJobsContent({ data, filters }: Props) {
  const { items, metrics, pagination } = data;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Cron ve İş Kuyrukları"
        description="Platform job'larını izleyin ve kontrollü manuel çalıştırın."
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { label: "Toplam job", value: metrics.total },
          { label: "Sağlıklı", value: metrics.healthy },
          { label: "Gecikmiş", value: metrics.overdue },
          { label: "Çalışan", value: metrics.running },
          { label: "Başarısız", value: metrics.failed },
          { label: "Hiç çalışmamış", value: metrics.neverRun },
          { label: "24s hata", value: metrics.failuresLast24h },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-slate-500">{m.label}</p>
            <p className="text-[15px] font-bold text-slate-800">{m.value}</p>
          </div>
        ))}
      </div>

      <div className={`${appPanelClass} p-4`}>
        <form action="/admin/jobs" method="get" className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Ara (min 2)…" className={appInputClass} />
          <select name="category" defaultValue={filters.category ?? "ALL"} className={appSelectClass}>
            <option value="ALL">Tüm kategoriler</option>
            <option value="billing">Billing</option>
            <option value="payment">Ödeme</option>
            <option value="notifications">Bildirimler</option>
            <option value="integrations">Entegrasyonlar</option>
            <option value="promotions">Promosyonlar</option>
            <option value="operations">Operasyon</option>
          </select>
          <select name="status" defaultValue={filters.status ?? "ALL"} className={appSelectClass}>
            <option value="ALL">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="pageSize" defaultValue={String(filters.pageSize)} className={appSelectClass}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <button type="submit" className={appPrimaryButtonClass}>
            Filtrele
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Son çalışma</th>
                <th className="px-3 py-2">Son başarı</th>
                <th className="px-3 py-2">Son hata</th>
                <th className="px-3 py-2">Süre</th>
                <th className="px-3 py-2">Manuel</th>
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
                items.map((job) => (
                  <tr key={job.key} className={appTableRowClass}>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">{job.label}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{job.categoryLabel}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{job.scheduleHint}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusClass(job.currentStatus)}`}>
                        {STATUS_LABELS[job.currentStatus] ?? job.currentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      {job.lastRun?.startedAt ? formatAdminDateTime(job.lastRun.startedAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      {job.lastSuccessAt ? formatAdminDateTime(job.lastSuccessAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      {job.lastFailureAt ? formatAdminDateTime(job.lastFailureAt) : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">
                      {job.lastRun?.durationMs != null ? `${job.lastRun.durationMs}ms` : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px]">{job.manualRunSupported ? "Evet" : "Hayır"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/jobs/${job.key}`} className="text-[12px] font-bold text-blue-700 hover:underline">
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
            {pagination.total} job · Sayfa {pagination.page}/{pagination.totalPages}
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 ? (
              <Link href={buildHref(filters, pagination.page - 1)} className="rounded-lg border px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50">
                Önceki
              </Link>
            ) : null}
            {pagination.page < pagination.totalPages ? (
              <Link href={buildHref(filters, pagination.page + 1)} className="rounded-lg border px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50">
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AdminPageContainer>
  );
}
