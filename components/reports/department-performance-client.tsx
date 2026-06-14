"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import {
  getAchievementStatus,
  getAchievementStatusLabel,
} from "@/lib/employee-performance-target-utils";
import { formatMoney, formatNumber } from "@/lib/format-utils";
import type { DepartmentPerformanceReport } from "@/lib/reports/department-performance-report";

type DepartmentPerformanceClientProps = {
  initialReport: DepartmentPerformanceReport;
};

export function DepartmentPerformanceClient({
  initialReport,
}: DepartmentPerformanceClientProps) {
  const [report, setReport] = useState(initialReport);
  const [from, setFrom] = useState(initialReport.period.from.slice(0, 10));
  const [to, setTo] = useState(initialReport.period.to.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    return `/api/reports/personnel-performance/departments/export?${params.toString()}`;
  }, [from, to]);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(
        `/api/reports/personnel-performance/departments?${params.toString()}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Departman raporu yüklenemedi.");
        return;
      }

      setReport({
        period: json.period,
        summary: json.summary,
        departments: json.departments,
      });
    } finally {
      setLoading(false);
    }
  }

  const kpiCards = [
    {
      label: "En yüksek ciro departmanı",
      value: report.summary.topRevenueDepartment ?? "—",
    },
    {
      label: "En yüksek skor",
      value: report.summary.topScoreDepartment ?? "—",
    },
    {
      label: "En yüksek verimlilik",
      value: report.summary.topEfficiencyDepartment ?? "—",
    },
    {
      label: "En çok izin kullanılan departman",
      value: report.summary.mostLeaveDepartment ?? "—",
    },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/reports/personnel-performance"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#0f1f4d]"
      >
        <ArrowLeft size={16} />
        Personel performansına dön
      </Link>

      <section className={TEAM_CARD_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0f1f4d]">
              Departman Performansı
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Departman bazlı ciro, maliyet, skor ve hedef başarı oranlarını
              karşılaştırın.
            </p>
          </div>
          <a
            href={exportUrl}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-[#0f1f4d]"
          >
            <Download className="h-4 w-4" />
            CSV indir
          </a>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-[11px] font-black uppercase text-slate-400">
              {item.label}
            </p>
            <p className="mt-2 text-lg font-black text-[#0f1f4d]">{item.value}</p>
          </div>
        ))}
      </div>

      <section className={[TEAM_CARD_CLASS, "overflow-x-auto"].join(" ")}>
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead>
            <tr className="border-b text-[11px] font-black uppercase text-slate-400">
              <th className="py-2 pr-4">Departman</th>
              <th className="py-2 pr-4">Çalışan</th>
              <th className="py-2 pr-4">Satış</th>
              <th className="py-2 pr-4">Ciro</th>
              <th className="py-2 pr-4">Maliyet</th>
              <th className="py-2 pr-4">Ciro/Çalışan</th>
              <th className="py-2 pr-4">Ort. Skor</th>
              <th className="py-2 pr-4">İzin</th>
              <th className="py-2">Hedef başarı %</th>
            </tr>
          </thead>
          <tbody>
            {report.departments.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  Seçilen dönem için departman kaydı bulunamadı.
                </td>
              </tr>
            ) : (
              report.departments.map((row) => (
                <tr key={row.department} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-black text-[#0f1f4d]">
                    <span className="inline-flex items-center gap-2">
                      {row.departmentColor ? (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-slate-200"
                          style={{ backgroundColor: row.departmentColor }}
                          aria-hidden
                        />
                      ) : null}
                      {row.department}
                      {row.isLegacyDepartment ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                          Eski
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{formatNumber(row.employeeCount)}</td>
                  <td className="py-3 pr-4">{formatNumber(row.totalSales)}</td>
                  <td className="py-3 pr-4">{formatMoney(row.totalRevenue)}</td>
                  <td className="py-3 pr-4">{formatMoney(row.totalPayrollCost)}</td>
                  <td className="py-3 pr-4">{formatMoney(row.revenuePerEmployee)}</td>
                  <td className="py-3 pr-4">
                    <ScoreBadge score={row.averageScore} />
                  </td>
                  <td className="py-3 pr-4">{formatNumber(row.leaveDays)}</td>
                  <td className="py-3">
                    <AchievementBadge
                      percent={row.achievement?.overallAchievementPercent ?? null}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
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
    score >= 70
      ? "bg-emerald-50 text-emerald-700"
      : score >= 40
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

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
