"use client";

import { useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import type { EmployeePerformanceDetail } from "@/lib/employee-performance-service";
import { formatEmployeeDate } from "@/lib/employee-page-utils";
import { formatMoney, formatNumber } from "@/lib/format-utils";
import {
  getAchievementStatus,
  getAchievementStatusLabel,
} from "@/lib/employee-performance-target-utils";
import Link from "next/link";

type EmployeePerformancePanelProps = {
  employeeId: string;
  initialPerformance: EmployeePerformanceDetail;
};

export function EmployeePerformancePanel({
  employeeId,
  initialPerformance,
}: EmployeePerformancePanelProps) {
  const [performance, setPerformance] = useState(initialPerformance);
  const [from, setFrom] = useState(initialPerformance.period.from.slice(0, 10));
  const [to, setTo] = useState(initialPerformance.period.to.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPerformance(nextFrom = from, nextTo = to) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: nextFrom, to: nextTo });
      const res = await fetch(
        `/api/employees/${employeeId}/performance?${params.toString()}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Performans verisi yüklenemedi.");
        return;
      }
      setPerformance(json.performance);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Başlangıç</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Bitiş</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadPerformance()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Uygula
          </button>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3">
          <p className="text-[11px] font-black uppercase text-emerald-700">
            Performans skoru
          </p>
          <p className="text-2xl font-black text-emerald-800">
            {performance.performanceScore}
            <span className="text-sm font-bold text-emerald-600"> / 100</span>
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}

      {!performance.hasLinkedUser ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Sistem hesabı bağlı değil — satış ve gider metrikleri yalnızca bağlı
          kullanıcılar için hesaplanır. İzin, ödeme ve snapshot kayıtları
          görüntülenmeye devam eder.
        </p>
      ) : null}

      <section className={[TEAM_CARD_CLASS, "space-y-4 p-5"].join(" ")}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-[#0f1f4d]">Dönem hedefi</h3>
          {!performance.target ? (
            <Link
              href="/reports/personnel-performance"
              className="text-xs font-black text-emerald-600 hover:underline"
            >
              Hedef tanımla
            </Link>
          ) : null}
        </div>
        {performance.target ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TargetProgress
                label="Ciro"
                actual={performance.totalSalesAmount}
                target={performance.target.revenueTarget}
                percent={performance.achievement?.revenueAchievementPercent ?? null}
              />
              <TargetProgress
                label="Satış adedi"
                actual={performance.totalSalesCount}
                target={performance.target.salesCountTarget}
                percent={performance.achievement?.salesCountAchievementPercent ?? null}
                formatValue={(value) => formatNumber(value)}
              />
            </div>
            {performance.achievement?.overallAchievementPercent != null ? (
              <p className="text-sm font-semibold text-slate-600">
                Genel hedef başarısı:{" "}
                <span className="font-black text-[#0f1f4d]">
                  %{performance.achievement.overallAchievementPercent}
                </span>{" "}
                ·{" "}
                {getAchievementStatusLabel(
                  getAchievementStatus(
                    performance.achievement.overallAchievementPercent
                  )
                )}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Bu dönem için tanımlı hedef yok. Raporlar sayfasından hedef
            oluşturabilirsiniz.
          </p>
        )}
      </section>

      {performance.trend.length > 0 ? (
        <section className={[TEAM_CARD_CLASS, "space-y-4 p-5"].join(" ")}>
          <h3 className="text-sm font-black text-[#0f1f4d]">Son 6 ay trendi</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            <TrendBars
              title="Skor"
              points={performance.trend.map((point) => ({
                label: formatEmployeeDate(point.periodStart).slice(0, 6),
                value: point.score ?? 0,
                max: 100,
              }))}
            />
            <TrendBars
              title="Ciro"
              points={performance.trend.map((point) => ({
                label: formatEmployeeDate(point.periodStart).slice(0, 6),
                value: point.revenue,
                max: Math.max(...performance.trend.map((item) => item.revenue), 1),
              }))}
              money
            />
            <TrendBars
              title="Satış adedi"
              points={performance.trend.map((point) => ({
                label: formatEmployeeDate(point.periodStart).slice(0, 6),
                value: point.salesCount,
                max: Math.max(...performance.trend.map((item) => item.salesCount), 1),
              }))}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Dönem satış adedi"
          value={formatNumber(performance.totalSalesCount)}
          sub={formatMoney(performance.totalSalesAmount)}
          change={performance.comparison.salesCountChangePercent}
        />
        <MetricCard
          label="Ortalama sepet"
          value={formatMoney(performance.averageTicket)}
          sub={`Tahsilat: ${formatMoney(performance.collectionTotal)}`}
        />
        <MetricCard
          label="POS / Manuel"
          value={`${performance.posSalesCount} / ${performance.manualSalesCount}`}
        />
        <MetricCard
          label="Fatura / Gider"
          value={`${performance.invoiceCount} / ${performance.expenseCount}`}
        />
        <MetricCard
          label="Personel maliyeti"
          value={formatMoney(performance.payrollCost)}
          sub={`Bekleyen: ${formatMoney(performance.pendingPayrollCost)}`}
        />
        <MetricCard
          label="Ciro / maliyet"
          value={
            performance.revenuePerPayrollCost != null
              ? `${performance.revenuePerPayrollCost}x`
              : "—"
          }
          sub="Verimlilik oranı"
        />
        <MetricCard
          label="İzin günü (dönem)"
          value={formatNumber(performance.leaveDaysInPeriod)}
          sub={`Toplam kullanılan: ${formatNumber(performance.leaveSummary.totalDaysUsed)}`}
        />
        <MetricCard
          label="Son aktivite"
          value={
            performance.lastActivityAt
              ? formatEmployeeDate(performance.lastActivityAt)
              : "—"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={[TEAM_CARD_CLASS, "space-y-3 p-5"].join(" ")}>
          <h3 className="text-sm font-black text-[#0f1f4d]">Ödeme özeti</h3>
          <div className="grid gap-2 text-sm text-slate-600">
            <p>Ödenen: {formatMoney(performance.paymentSummary.totalPaid)}</p>
            <p>Bekleyen: {formatMoney(performance.paymentSummary.totalPending)}</p>
            <p>Kesinti: {formatMoney(performance.paymentSummary.totalDeductions)}</p>
            <p className="font-black text-[#0f1f4d]">
              Net ödenecek: {formatMoney(performance.paymentSummary.netPayable)}
            </p>
          </div>
        </section>

        <section className={[TEAM_CARD_CLASS, "space-y-3 p-5"].join(" ")}>
          <h3 className="text-sm font-black text-[#0f1f4d]">
            Önceki dönem karşılaştırması
          </h3>
          <div className="grid gap-2 text-sm text-slate-600">
            <ComparisonRow
              label="Ciro değişimi"
              value={performance.comparison.revenueChangePercent}
              current={formatMoney(performance.totalSalesAmount)}
              previous={formatMoney(performance.comparison.previousRevenue)}
            />
            <ComparisonRow
              label="Satış adedi değişimi"
              value={performance.comparison.salesCountChangePercent}
              current={String(performance.totalSalesCount)}
              previous={String(performance.comparison.previousSalesCount)}
            />
          </div>
        </section>
      </div>

      {performance.manualRecords.length > 0 ? (
        <section className={[TEAM_CARD_CLASS, "overflow-x-auto p-5"].join(" ")}>
          <h3 className="mb-4 text-sm font-black text-[#0f1f4d]">
            Performans snapshot kayıtları
          </h3>
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b text-[11px] font-black uppercase text-slate-400">
                <th className="py-2 pr-4">Dönem</th>
                <th className="py-2 pr-4">Satış</th>
                <th className="py-2 pr-4">Ciro</th>
                <th className="py-2 pr-4">POS/Manuel</th>
                <th className="py-2 pr-4">Skor</th>
                <th className="py-2">Not</th>
              </tr>
            </thead>
            <tbody>
              {performance.manualRecords.map((record) => (
                <tr key={record.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4">
                    {formatEmployeeDate(record.periodStart)} –{" "}
                    {formatEmployeeDate(record.periodEnd)}
                  </td>
                  <td className="py-3 pr-4">{record.salesCount}</td>
                  <td className="py-3 pr-4">{formatMoney(record.salesTotal)}</td>
                  <td className="py-3 pr-4">
                    {record.posSalesCount} / {record.manualSalesCount}
                  </td>
                  <td className="py-3 pr-4">
                    {record.taskScore != null ? record.taskScore : "—"}
                  </td>
                  <td className="py-3 text-slate-500">{record.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {performance.lastActivities.length > 0 ? (
        <section className={[TEAM_CARD_CLASS, "space-y-3 p-5"].join(" ")}>
          <h3 className="text-sm font-black text-[#0f1f4d]">Son aktiviteler</h3>
          <ul className="space-y-2">
            {performance.lastActivities.map((activity) => (
              <li
                key={activity.id}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                <p>{activity.message}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatEmployeeDate(activity.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  change,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-lg font-black text-[#0f1f4d]">{value}</p>
        {change != null ? <ChangeBadge value={change} /> : null}
      </div>
      {sub ? <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ChangeBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <span
      className={[
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black",
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

function ComparisonRow({
  label,
  value,
  current,
  previous,
}: {
  label: string;
  value: number;
  current: string;
  previous: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div>
        <p className="font-semibold text-[#0f1f4d]">{label}</p>
        <p className="text-xs text-slate-500">
          {current} · önceki {previous}
        </p>
      </div>
      <ChangeBadge value={value} />
    </div>
  );
}

function TargetProgress({
  label,
  actual,
  target,
  percent,
  formatValue = (value: number) => formatMoney(value),
}: {
  label: string;
  actual: number;
  target: number | null;
  percent: number | null;
  formatValue?: (value: number) => string;
}) {
  const width = percent != null ? Math.min(100, percent) : 0;

  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase text-slate-400">{label}</p>
        {percent != null ? <span className="text-xs font-black">%{percent}</span> : null}
      </div>
      <p className="mt-2 text-sm font-black text-[#0f1f4d]">
        {formatValue(actual)}
        {target != null ? ` / ${formatValue(target)}` : ""}
      </p>
      <div className="mt-3 h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function TrendBars({
  title,
  points,
  money = false,
}: {
  title: string;
  points: Array<{ label: string; value: number; max: number }>;
  money?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-400">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        {points.map((point) => {
          const height = point.max > 0 ? Math.max(8, (point.value / point.max) * 72) : 8;
          return (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-[#0f1f4d]"
                style={{ height }}
                title={money ? formatMoney(point.value) : String(point.value)}
              />
              <span className="text-[10px] font-bold text-slate-400">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
