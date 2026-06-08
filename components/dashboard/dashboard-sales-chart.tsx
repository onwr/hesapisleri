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
};

function formatAxis(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}B`;
  return String(value);
}

function formatTooltip(value: number) {
  return formatMoney(value);
}

export function DashboardSalesChart({
  data,
  monthLabel,
}: DashboardSalesChartProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
          Satış Grafiği
        </h3>

        <select
          className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-[#0f1f4d] outline-none"
          defaultValue="current"
          aria-label="Dönem seçimi"
        >
          <option value="current">Bu Ay</option>
        </select>
      </div>

      <div className="h-[245px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={38}
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
    </div>
  );
}