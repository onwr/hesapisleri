"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { formatMoney } from "@/lib/format-utils";

export type AiChartPoint = {
  label: string;
  income: number;
  expense: number;
  value?: number;
};

export function AiMiniLineChart({
  data,
  color = "#22c55e",
}: {
  data: { value: number }[];
  color?: string;
}) {
  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AiFinanceLineChart({ data }: { data: AiChartPoint[] }) {
  return (
    <div className="h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickFormatter={(value) => `${Math.round(Number(value) / 1000)}B`}
          />

          <Tooltip
            formatter={(value) => formatMoney(Number(value))}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
              fontSize: 12,
            }}
          />

          <Line
            type="monotone"
            dataKey="income"
            name="Gelir"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#22c55e" }}
          />

          <Line
            type="monotone"
            dataKey="expense"
            name="Gider"
            stroke="#fb7185"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#fb7185" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}