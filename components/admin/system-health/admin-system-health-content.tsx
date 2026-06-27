"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { HealthCheckDetails } from "@/components/admin/system-health/health-check-details";

type Check = {
  id: string;
  label: string;
  category: string;
  criticality: string;
  status: string;
  summary: string;
  durationMs: number;
  checkedAt: string;
  details: Record<string, unknown>;
  suggestedAction: string | null;
  issues: string[];
};

type Summary = {
  overallStatus: string;
  checkedAt: string;
  totalChecks: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  notConfigured: number;
  criticalIssues: number;
  errorsLast24h: number;
};

type Snapshot = {
  summary: Summary;
  checks: Check[];
  cached: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  HEALTHY: "Sağlıklı",
  DEGRADED: "Bozulmuş",
  UNHEALTHY: "Sağlıksız",
  UNKNOWN: "Bilinmiyor",
  NOT_CONFIGURED: "Yapılandırılmamış",
};

const OVERALL_LABELS: Record<string, string> = {
  HEALTHY: "Sağlıklı",
  DEGRADED: "Bozulmuş",
  UNHEALTHY: "Sağlıksız",
  UNKNOWN: "Bilinmiyor",
};

const CATEGORY_LABELS: Record<string, string> = {
  application: "Uygulama",
  database: "Veritabanı",
  prisma: "Prisma",
  cache: "Cache",
  storage: "Depolama",
  payment: "Ödeme",
  billing: "Billing",
  email: "E-posta",
  integrations: "Entegrasyonlar",
  cron: "Cron / Job",
};

function statusBadgeClass(status: string) {
  if (status === "HEALTHY") return "bg-emerald-100 text-emerald-800";
  if (status === "DEGRADED") return "bg-amber-100 text-amber-800";
  if (status === "UNHEALTHY") return "bg-rose-100 text-rose-800";
  if (status === "NOT_CONFIGURED") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

function overallBadgeClass(status: string) {
  if (status === "HEALTHY") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "DEGRADED") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "UNHEALTHY") return "border-rose-300 bg-rose-50 text-rose-900";
  return "border-slate-300 bg-slate-50 text-slate-800";
}

export function AdminSystemHealthContent({ initial }: { initial: Snapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [category, setCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [criticality, setCriticality] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    return snapshot.checks.filter((c) => {
      if (category !== "ALL" && c.category !== category) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (criticality !== "ALL" && c.criticality !== criticality) return false;
      return true;
    });
  }, [snapshot.checks, category, statusFilter, criticality]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/system-health?refresh=1");
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Yenileme başarısız.");
      setSnapshot(json.data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yenileme başarısız.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const runCheck = useCallback(async (checkId: string) => {
    setRunningId(checkId);
    setError("");
    try {
      const res = await fetch(`/api/admin/system-health/checks/${checkId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Kontrol başarısız.");
      const updated = json.data.check as Check;
      setSnapshot((prev) => ({
        ...prev,
        cached: false,
        checks: prev.checks.map((c) => (c.id === checkId ? updated : c)),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kontrol başarısız.");
    } finally {
      setRunningId(null);
    }
  }, []);

  const { summary } = snapshot;

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Sistem Sağlığı"
        description="Uygulama altyapısı salt okunur sağlık kontrolleri."
        secondaryActions={
          <button
            type="button"
            className={appPrimaryButtonClass}
            disabled={loading}
            onClick={() => void refreshAll()}
          >
            {loading ? "Yenileniyor…" : "Kontrolleri Yenile"}
          </button>
        }
      />

      {error ? <p className="mb-3 text-[13px] text-rose-600">{error}</p> : null}

      <div
        className={`mb-4 rounded-xl border px-4 py-3 ${overallBadgeClass(summary.overallStatus)}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">Genel durum</p>
            <p className="text-xl font-bold">{OVERALL_LABELS[summary.overallStatus] ?? summary.overallStatus}</p>
          </div>
          <div className="text-[12px] opacity-80">
            Son kontrol: {formatAdminDateTime(summary.checkedAt)}
            {snapshot.cached ? " · önbellek" : null}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {[
            { label: "Toplam", value: summary.totalChecks },
            { label: "Başarılı", value: summary.healthy },
            { label: "Bozulmuş", value: summary.degraded },
            { label: "Başarısız", value: summary.unhealthy },
            { label: "Bilinmeyen", value: summary.unknown },
            { label: "Yapılandırılmamış", value: summary.notConfigured },
            { label: "Kritik sorun", value: summary.criticalIssues },
            { label: "24s hata log", value: summary.errorsLast24h },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-white/60 bg-white/50 px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase opacity-60">{m.label}</p>
              <p className="text-[15px] font-bold">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${appPanelClass} p-4`}>
        <div className="mb-4 flex flex-wrap gap-2">
          <select className={appSelectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="ALL">Tüm kategoriler</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={appSelectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tüm durumlar</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={appSelectClass} value={criticality} onChange={(e) => setCriticality(e.target.value)}>
            <option value="ALL">Tüm öncelikler</option>
            <option value="critical">Kritik</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2">Kontrol</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Süre</th>
                <th className="px-3 py-2">Özet</th>
                <th className="px-3 py-2">Detay</th>
                <th className="px-3 py-2">Öneri</th>
                <th className="px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-slate-500">
                    Filtreye uygun kontrol yok.
                  </td>
                </tr>
              ) : (
                filtered.map((check) => (
                  <tr key={check.id} className={appTableRowClass}>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">
                      {check.label}
                      {check.criticality === "critical" ? (
                        <span className="ml-1 text-[10px] text-rose-600">kritik</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {CATEGORY_LABELS[check.category] ?? check.category}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(check.status)}`}
                      >
                        {STATUS_LABELS[check.status] ?? check.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-500">{check.durationMs}ms</td>
                    <td className="max-w-[180px] px-3 py-2 text-[12px] text-slate-700">{check.summary}</td>
                    <td className="max-w-[260px] px-3 py-2 text-[11px] text-slate-500">
                      <HealthCheckDetails details={check.details} />
                    </td>
                    <td className="max-w-[160px] px-3 py-2 text-[11px] text-slate-600">
                      {check.suggestedAction ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className={appOutlineButtonClass}
                        disabled={runningId === check.id}
                        onClick={() => void runCheck(check.id)}
                      >
                        {runningId === check.id ? "…" : "Çalıştır"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageContainer>
  );
}
