"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format-utils";

type SalesChartPoint = {
  day: string;
  amount: number;
  label: string;
};

type DashboardSalesChartProps = {
  data: SalesChartPoint[];
  monthLabel: string;
  compact?: boolean;
};

function formatAxis(value: number) {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function formatTooltip(value: number) {
  return formatMoney(value);
}

export function DashboardSalesChart({
  data,
  monthLabel,
  compact = false,
}: DashboardSalesChartProps) {
  const totalSales = data.reduce((sum, point) => sum + point.amount, 0);
  const hasData = data.some((point) => point.amount > 0);
  const chartHeight = compact ? 0 : 245;
  const summaryId = "dashboard-sales-chart-summary";

  return (
    <figure
      className={[
        "min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
        compact ? "p-4" : "p-5",
      ].join(" ")}
      aria-label={`${monthLabel} satış grafiği, toplam ${formatMoney(totalSales)}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-extrabold text-[#0f1f4d]">
          Satış Grafiği
        </h3>

        <label className="sr-only" htmlFor="dashboard-sales-period">
          Dönem seçimi
        </label>
        <select
          id="dashboard-sales-period"
          className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-[#0f1f4d] outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          defaultValue="current"
          aria-label={`Satış dönemi: ${monthLabel}`}
        >
          <option value="current">{monthLabel}</option>
        </select>
      </div>

      <figcaption className="sr-only" id={summaryId}>
        {hasData
          ? `${monthLabel} boyunca toplam satış ${formatMoney(totalSales)}. Günlük dağılım: ${data
              .filter((point) => point.amount > 0)
              .map((point) => `${point.label} ${formatMoney(point.amount)}`)
              .join(", ")}.`
          : `${monthLabel} için henüz satış verisi yok.`}
      </figcaption>

      {!hasData ? (
        <div
          className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center"
          role="status"
        >
          <p className="text-[13px] font-medium text-slate-500">
            Bu dönemde satış verisi yok. İlk satışınızı oluşturduğunuzda grafik
            burada görünecek.
          </p>
        </div>
      ) : (
        <div className="h-[245px] w-full min-w-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 12, left: -8, bottom: 0 }}
              aria-hidden="true"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                vertical={false}
              />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />

              <YAxis
                tickFormatter={formatAxis}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />

              <Tooltip
                formatter={(value) => [formatTooltip(Number(value)), "Satış"]}
                labelFormatter={(label) => `${monthLabel} — ${label}`}
                contentStyle={{
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  boxShadow: "0 12px 30px rgba(15,23,42,0.10)",
                }}
              />

              <Line
                type="monotone"
                dataKey="amount"
                name="Satış"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{
                  r: 4,
                  fill: "#2563eb",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: "#2563eb",
                  stroke: "#ffffff",
                  strokeWidth: 3,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
