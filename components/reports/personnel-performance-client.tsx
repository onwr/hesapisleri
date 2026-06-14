"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Target } from "lucide-react";
import { PerformanceTargetModal } from "@/components/reports/performance-target-modal";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import type { PersonnelPerformanceReport } from "@/lib/employee-performance-service";
import {
  getAchievementStatus,
  getAchievementStatusLabel,
} from "@/lib/employee-performance-target-utils";
import { formatMoney, formatNumber } from "@/lib/format-utils";

type PersonnelPerformanceClientProps = {
  initialReport: PersonnelPerformanceReport;
  departments: string[];
  employees: Array<{ id: string; name: string }>;
  canManageTargets: boolean;
};

export function PersonnelPerformanceClient({
  initialReport,
  departments,
  employees,
  canManageTargets,
}: PersonnelPerformanceClientProps) {
  const [report, setReport] = useState(initialReport);
  const [from, setFrom] = useState(initialReport.period.from.slice(0, 10));
  const [to, setTo] = useState(initialReport.period.to.slice(0, 10));
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState("");

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (department) params.set("department", department);
    if (employeeId) params.set("employeeId", employeeId);
    return `/api/reports/personnel-performance/export?${params.toString()}`;
  }, [from, to, department, employeeId]);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (department) params.set("department", department);
      if (employeeId) params.set("employeeId", employeeId);

      const res = await fetch(`/api/reports/personnel-performance?${params.toString()}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Rapor yüklenemedi.");
        return;
      }

      setReport({
        period: json.period,
        summary: json.summary,
        employees: json.employees,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTarget(payload: {
    scope: "employee" | "department" | "company";
    employeeId?: string;
    department?: string;
    periodStart: string;
    periodEnd: string;
    revenueTarget?: number;
    salesCountTarget?: number;
    collectionTarget?: number;
    maxLeaveDays?: number;
    scoreTarget?: number;
    notes?: string;
  }) {
    setTargetSaving(true);
    setTargetError("");
    try {
      const res = await fetch("/api/employees/performance-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: payload.scope === "employee" ? payload.employeeId : null,
          department: payload.scope === "department" ? payload.department : null,
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          revenueTarget: payload.revenueTarget,
          salesCountTarget: payload.salesCountTarget,
          collectionTarget: payload.collectionTarget,
          maxLeaveDays: payload.maxLeaveDays,
          scoreTarget: payload.scoreTarget,
          notes: payload.notes,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setTargetError(json.message ?? "Hedef kaydedilemedi.");
        return;
      }

      setTargetOpen(false);
      await loadReport();
    } finally {
      setTargetSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/reports"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Raporlara dön
      </Link>

      <section className={TEAM_CARD_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0f1f4d]">
              Personel Performansı
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Satış, ciro, personel maliyeti, hedef ve başarı oranlarını karşılaştırın.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/personnel-performance/targets"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
            >
              <Target className="h-4 w-4" />
              {canManageTargets ? "Hedefleri Yönet" : "Performans Hedefleri"}
            </Link>
            <Link
              href="/reports/personnel-performance/departments"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
            >
              Departman Performansı
            </Link>
            {canManageTargets ? (
              <button
                type="button"
                onClick={() => {
                  setTargetError("");
                  setTargetOpen(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white"
              >
                <Target className="h-4 w-4" />
                Hedefler
              </button>
            ) : null}
            <a
              href={exportUrl}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
            >
              <Download className="h-4 w-4" />
              CSV indir
            </a>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <FilterField label="Başlangıç">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Bitiş">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Departman">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Tümü</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Çalışan">
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Tümü</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FilterField>
          <button
            type="button"
            disabled={loading}
            onClick={loadReport}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Filtrele
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: "Çalışan", value: formatNumber(report.summary.employeeCount) },
          { label: "Toplam satış", value: formatNumber(report.summary.totalSales) },
          { label: "Toplam ciro", value: formatMoney(report.summary.totalRevenue) },
          {
            label: "Personel maliyeti",
            value: formatMoney(report.summary.totalPayrollCost),
          },
          {
            label: "Kişi başı ciro",
            value: formatMoney(report.summary.revenuePerEmployee),
          },
          {
            label: "Kişi başı satış",
            value: formatNumber(report.summary.averageSalesPerEmployee),
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-[11px] font-black uppercase text-slate-400">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-black text-[#0f1f4d]">{item.value}</p>
          </div>
        ))}
      </div>

      <section className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
        <table className="min-w-[1400px] w-full text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] font-black uppercase text-slate-400">
              <th className="py-2 pr-4">Çalışan</th>
              <th className="py-2 pr-4">Departman</th>
              <th className="py-2 pr-4">Hedef satış</th>
              <th className="py-2 pr-4">Satış</th>
              <th className="py-2 pr-4">Hedef ciro</th>
              <th className="py-2 pr-4">Ciro</th>
              <th className="py-2 pr-4">Başarı %</th>
              <th className="py-2 pr-4">Maliyet</th>
              <th className="py-2 pr-4">İzin</th>
              <th className="py-2 pr-4">Skor</th>
              <th className="py-2">Detay</th>
            </tr>
          </thead>
          <tbody>
            {report.employees.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400">
                  Seçilen filtreler için kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              report.employees.map((row) => (
                <tr key={row.employeeId} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-black text-[#0f1f4d]">
                    {row.employeeName}
                    {!row.hasLinkedUser ? (
                      <span className="ml-2 text-[10px] font-bold text-amber-600">
                        Hesap yok
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">{row.department ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {row.target?.salesCountTarget != null
                      ? formatNumber(row.target.salesCountTarget)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">{formatNumber(row.salesCount)}</td>
                  <td className="py-3 pr-4">
                    {row.target?.revenueTarget != null
                      ? formatMoney(row.target.revenueTarget)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">{formatMoney(row.revenue)}</td>
                  <td className="py-3 pr-4">
                    <AchievementBadge
                      percent={row.achievement?.overallAchievementPercent ?? null}
                    />
                  </td>
                  <td className="py-3 pr-4">{formatMoney(row.payrollCost)}</td>
                  <td className="py-3 pr-4">{formatNumber(row.leaveDays)}</td>
                  <td className="py-3 pr-4">
                    <ScoreBadge score={row.performanceScore} />
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/team/${row.employeeId}?tab=performance`}
                      className="text-xs font-black text-emerald-600 hover:underline"
                    >
                      Çalışan detayı
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {canManageTargets ? (
        <PerformanceTargetModal
        open={targetOpen}
        mode="create"
        saving={targetSaving}
        error={targetError}
        periodStart={from}
        periodEnd={to}
        departments={departments}
        employees={employees}
        onClose={() => setTargetOpen(false)}
        onSubmit={(payload) =>
          handleCreateTarget({
            scope: payload.scope,
            employeeId: payload.employeeId,
            department: payload.department,
            periodStart: payload.periodStart,
            periodEnd: payload.periodEnd,
            revenueTarget: payload.revenueTarget,
            salesCountTarget: payload.salesCountTarget,
            collectionTarget: payload.collectionTarget,
            maxLeaveDays: payload.maxLeaveDays,
            scoreTarget: payload.scoreTarget,
            notes: payload.notes,
          })
        }
      />
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 70 ? "bg-emerald-50 text-emerald-700" : score >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600";

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
        tone,
      ].join(" ")}
    >
      {score}
    </span>
  );
}

function AchievementBadge({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <span className="text-slate-400">—</span>;
  }

  const status = getAchievementStatus(percent);
  const tone =
    status === "success"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "approaching"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-red-50 text-red-600 ring-red-100";

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset",
        tone,
      ].join(" ")}
      title={getAchievementStatusLabel(status)}
    >
      %{percent}
    </span>
  );
}
