"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format-utils";

type IncomeExpenseData = {
  income: number;
  expense: number;
  profit: number;
};

type DashboardIncomeChartProps = {
  data: IncomeExpenseData;
};

const COLORS = {
  income: "#22c55e",
  expense: "#ef4444",
  profit: "#3b82f6",
};

export function DashboardIncomeChart({ data }: DashboardIncomeChartProps) {
  const chartData = [
    { name: "Toplam Gelir", value: data.income, color: COLORS.income },
    { name: "Toplam Gider", value: data.expense, color: COLORS.expense },
    { name: "Kâr", value: Math.max(data.profit, 0), color: COLORS.profit },
  ].filter((item) => item.value > 0);

  const hasData = chartData.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <h3 className="mb-3 text-[15px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
        Gelir - Gider Durumu
      </h3>

      <div className="flex h-[205px] items-center gap-7">
        <div className="relative h-[165px] w-[165px] shrink-0">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={57}
                  outerRadius={80}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
              Veri yok
            </div>
          )}

          {hasData ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[17px] font-extrabold leading-none tracking-[-0.03em] text-[#0f1f4d]">
                {formatMoney(data.profit)}
              </p>
              <p className="mt-1 text-[11px] font-bold leading-none text-slate-500">
                Kâr
              </p>
            </div>
          ) : null}
        </div>

        <div className="w-full max-w-[310px] space-y-4">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="grid grid-cols-[12px_1fr_auto] items-center gap-3"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />

              <p className="truncate text-[12px] font-semibold text-[#24345f]">
                {item.name}
              </p>

              <p className="whitespace-nowrap text-[12px] font-extrabold tracking-[-0.01em] text-[#0f1f4d]">
                {formatMoney(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}