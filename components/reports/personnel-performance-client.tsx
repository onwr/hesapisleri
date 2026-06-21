"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  Download,
  Eye,
  Filter,
  Loader2,
  ShoppingCart,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import { PerformanceTargetModal } from "@/components/reports/performance-target-modal";
import { TeamActionButton } from "@/components/team/team-action-button";
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

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-orange-500",
  "bg-rose-500",
  "bg-cyan-600",
];

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

  const hasFilters = Boolean(department || employeeId);

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (department) params.set("department", department);
      if (employeeId) params.set("employeeId", employeeId);

      const res = await fetch(
        `/api/reports/personnel-performance?${params.toString()}`
      );
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

  function openTargetModal() {
    setTargetError("");
    setTargetOpen(true);
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canManageTargets ? (
          <TeamActionButton
            title="Performans Hedefi"
            description="Yeni hedef tanımla"
            onClick={openTargetModal}
            icon={<Target size={22} strokeWidth={2.4} />}
            gradient="bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a]"
          />
        ) : null}

        <ActionCard
          title="Hedefleri Yönet"
          description={
            canManageTargets ? "Hedef kayıtlarını düzenle" : "Hedef listesini gör"
          }
          href="/reports/personnel-performance/targets"
          icon={<Target size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-violet-500 to-purple-600"
        />

        <ActionCard
          title="Departman Performansı"
          description="Departman bazlı karşılaştır"
          href="/reports/personnel-performance/departments"
          icon={<Building2 size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-blue-500 to-blue-600"
        />

        <ActionCard
          title="Excel Dışa Aktar"
          description="CSV olarak indir"
          href={exportUrl}
          icon={<Download size={22} strokeWidth={2.4} />}
          gradient="bg-linear-to-br from-emerald-500 to-green-600"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Çalışan"
          value={formatNumber(report.summary.employeeCount)}
          subtitle="Rapor kapsamındaki personel"
          icon={<Users size={18} />}
          color="blue"
        />
        <StatCard
          title="Toplam Satış"
          value={formatNumber(report.summary.totalSales)}
          subtitle="Seçili dönem satış adedi"
          icon={<ShoppingCart size={18} />}
          color="green"
        />
        <StatCard
          title="Toplam Ciro"
          value={formatMoney(report.summary.totalRevenue)}
          subtitle="Seçili dönem gelir toplamı"
          icon={<TrendingUp size={18} />}
          color="purple"
        />
        <StatCard
          title="Personel Maliyeti"
          value={formatMoney(report.summary.totalPayrollCost)}
          subtitle="Bordro ve ödeme maliyeti"
          icon={<Wallet size={18} />}
          color="orange"
        />
        <StatCard
          title="Kişi Başı Ciro"
          value={formatMoney(report.summary.revenuePerEmployee)}
          subtitle="Ortalama çalışan cirosu"
          icon={<BarChart3 size={18} />}
          color="blue"
        />
        <StatCard
          title="Kişi Başı Satış"
          value={formatNumber(report.summary.averageSalesPerEmployee)}
          subtitle="Ortalama satış adedi"
          icon={<Target size={18} />}
          color="green"
        />
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-[#0f1f4d]">
                  Personel Performans Tablosu
                </h2>
                <p className="mt-1 text-[12px] font-medium text-slate-500">
                  Satış, ciro, maliyet, hedef ve başarı oranları
                </p>
              </div>

              <Link
                href="/reports"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
              >
                Tüm Raporlar
              </Link>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadReport();
              }}
              className="flex w-full flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end"
            >
              <FilterField label="Başlangıç">
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </FilterField>

              <FilterField label="Bitiş">
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-10 w-full min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </FilterField>

              <FilterField label="Departman">
                <select
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="h-10 w-full min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="h-10 w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[#0f1f4d] outline-none"
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
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-[12px] font-black text-white transition hover:bg-[#16285f] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <Filter size={14} />
                Filtrele
              </button>
            </form>
          </div>

          {report.employees.length === 0 ? (
            <PerformanceEmptyState hasFilters={hasFilters} />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1200px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                      <th className="px-4 py-3">Çalışan</th>
                      <th className="px-4 py-3">Departman</th>
                      <th className="px-4 py-3">Hedef Satış</th>
                      <th className="px-4 py-3">Satış</th>
                      <th className="px-4 py-3">Hedef Ciro</th>
                      <th className="px-4 py-3">Ciro</th>
                      <th className="px-4 py-3">Başarı</th>
                      <th className="px-4 py-3">Maliyet</th>
                      <th className="px-4 py-3">İzin</th>
                      <th className="px-4 py-3">Skor</th>
                      <th className="px-4 py-3 text-center">İşlem</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {report.employees.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                                getAvatarColor(row.employeeName),
                              ].join(" ")}
                            >
                              {getInitials(row.employeeName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-extrabold text-[#0f1f4d]">
                                {row.employeeName}
                              </p>
                              {!row.hasLinkedUser ? (
                                <p className="text-[10px] font-bold text-amber-600">
                                  Hesap yok
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {row.department ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          {row.target?.salesCountTarget != null
                            ? formatNumber(row.target.salesCountTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3 font-bold text-[#0f1f4d]">
                          {formatNumber(row.salesCount)}
                        </td>

                        <td className="px-4 py-3">
                          {row.target?.revenueTarget != null
                            ? formatMoney(row.target.revenueTarget)
                            : "—"}
                        </td>

                        <td className="px-4 py-3 font-black text-emerald-600">
                          {formatMoney(row.revenue)}
                        </td>

                        <td className="px-4 py-3">
                          <AchievementBadge
                            percent={
                              row.achievement?.overallAchievementPercent ?? null
                            }
                          />
                        </td>

                        <td className="px-4 py-3">
                          {formatMoney(row.payrollCost)}
                        </td>

                        <td className="px-4 py-3">
                          {formatNumber(row.leaveDays)}
                        </td>

                        <td className="px-4 py-3">
                          <ScoreBadge score={row.performanceScore} />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <Link
                              href={`/team/${row.employeeId}?tab=performance`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Çalışan detayı"
                            >
                              <Eye size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 border-t border-slate-100 p-4 lg:hidden">
                {report.employees.map((row) => (
                  <article
                    key={row.employeeId}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white",
                          getAvatarColor(row.employeeName),
                        ].join(" ")}
                      >
                        {getInitials(row.employeeName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold text-[#0f1f4d]">
                          {row.employeeName}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          {row.department ?? "Departman yok"}
                        </p>
                      </div>
                      <ScoreBadge score={row.performanceScore} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                      <span>Satış: {formatNumber(row.salesCount)}</span>
                      <span>Ciro: {formatMoney(row.revenue)}</span>
                      <span>Maliyet: {formatMoney(row.payrollCost)}</span>
                      <span>İzin: {formatNumber(row.leaveDays)} gün</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <AchievementBadge
                        percent={
                          row.achievement?.overallAchievementPercent ?? null
                        }
                      />
                      <Link
                        href={`/team/${row.employeeId}?tab=performance`}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#0f1f4d]"
                      >
                        Detay
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <p className="text-[12px] font-extrabold text-[#24345f]/80">
              Dönem Özeti
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {formatPeriodLabel(from)} – {formatPeriodLabel(to)}
            </p>

            <div className="mt-4 space-y-3">
              <SummaryRow
                label="Toplam ciro"
                value={formatMoney(report.summary.totalRevenue)}
                tone="emerald"
              />
              <SummaryRow
                label="Toplam satış"
                value={formatNumber(report.summary.totalSales)}
              />
              <SummaryRow
                label="Personel maliyeti"
                value={formatMoney(report.summary.totalPayrollCost)}
                tone="orange"
              />
              <SummaryRow
                label="Kişi başı ciro"
                value={formatMoney(report.summary.revenuePerEmployee)}
                tone="blue"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-[#0f1f4d] to-[#1e3a8a] p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]">
            <p className="text-[13px] font-black">Performans Takibi</p>
            <p className="mt-2 text-[12px] leading-6 text-white/80">
              Hedef tanımlayın, departman kırılımını inceleyin ve sonuçları CSV
              olarak dışa aktarın.
            </p>
            <Link
              href="/team"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-[12px] font-black text-[#0f1f4d]"
            >
              Çalışanlara Git
            </Link>
          </div>
        </aside>
      </div>

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

function PerformanceEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
          <BarChart3 size={28} />
        </div>

        <p className="mt-4 text-lg font-black text-[#0f1f4d]">
          {hasFilters
            ? "Seçilen filtreler için kayıt bulunamadı"
            : "Bu dönemde performans kaydı yok"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasFilters
            ? "Departman veya çalışan filtresini değiştirerek tekrar deneyin."
            : "Çalışan satış ve hedef verileri oluştukça burada görünecek."}
        </p>

        <Link
          href="/team"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white"
        >
          Çalışanlara Git
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "orange" | "blue";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "orange"
        ? "text-orange-600"
        : tone === "blue"
          ? "text-blue-600"
          : "text-[#0f1f4d]";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
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
    <label className="block space-y-1">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
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
        "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
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
      ? "bg-emerald-50 text-emerald-700"
      : status === "approaching"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";

  return (
    <span
      className={[
        "inline-flex rounded-md px-2 py-1 text-[10px] font-black",
        tone,
      ].join(" ")}
      title={getAchievementStatusLabel(status)}
    >
      %{percent}
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(name: string) {
  const hash = name
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatPeriodLabel(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
