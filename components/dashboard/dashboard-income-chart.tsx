"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format-utils";

type IncomeExpenseData = {
  income: number;
  expense: number;
  profit: number;
  accrualProfit?: number | null;
  revenueLabel?: string;
  expenseLabel?: string;
  profitLabel?: string;
  profitTooltip?: string;
  accrualProfitLabel?: string;
  basisNote?: string;
};

type DashboardIncomeChartProps = {
  data: IncomeExpenseData;
  compact?: boolean;
};

const COLORS = {
  income: "#16a34a",
  expense: "#dc2626",
  profit: "#2563eb",
};

const PATTERNS = {
  income: "5 0",
  expense: "2 2",
  profit: "8 4",
};

export function DashboardIncomeChart({
  data,
  compact = false,
}: DashboardIncomeChartProps) {
  const chartData = [
    {
      key: "income",
      name: data.revenueLabel ?? "Nakit Gelir",
      value: data.income,
      color: COLORS.income,
      strokeDasharray: PATTERNS.income,
    },
    {
      key: "expense",
      name: data.expenseLabel ?? "Nakit Gider",
      value: data.expense,
      color: COLORS.expense,
      strokeDasharray: PATTERNS.expense,
    },
    {
      key: "profit",
      name: data.profitLabel ?? "Operasyonel Nakit Sonucu",
      value: Math.max(data.profit, 0),
      color: COLORS.profit,
      strokeDasharray: PATTERNS.profit,
    },
  ].filter((item) => item.value > 0);

  const hasData = chartData.length > 0;
  const summaryId = "dashboard-income-chart-summary";

  return (
    <figure
      className={[
        "min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
        compact ? "p-4" : "p-4",
      ].join(" ")}
      aria-label={`Gelir gider durumu, ${data.profitLabel ?? "operasyonel nakit sonucu"} ${formatMoney(data.profit)}`}
    >
      <h3 className="mb-3 text-[16px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
        Gelir - Gider Durumu
      </h3>
      {data.profitTooltip || data.basisNote ? (
        <p
          className="mb-3 text-[11px] font-semibold leading-5 text-slate-500"
          title={data.profitTooltip}
        >
          {data.basisNote ?? data.profitTooltip}
        </p>
      ) : (
        <p className="mb-3 text-[11px] font-semibold leading-5 text-slate-500">
          Seçili dönemde gerçekleşen nakit girişleri ile nakit çıkışları arasındaki farktır.
        </p>
      )}
      {data.accrualProfit != null ? (
        <p className="mb-3 text-[11px] font-semibold leading-5 text-slate-500">
          {data.accrualProfitLabel ?? "Tahakkuk Kârı"}: {formatMoney(data.accrualProfit)}
          <span className="font-medium text-slate-400">
            {" "}
            (tahakkuk satış − tahakkuk gider; nakit sonucundan ayrıdır)
          </span>
        </p>
      ) : null}

      <figcaption className="sr-only" id={summaryId}>
        {hasData
          ? `Nakit gelir ${formatMoney(data.income)}, nakit gider ${formatMoney(data.expense)}, ${data.profitLabel ?? "operasyonel nakit sonucu"} ${formatMoney(data.profit)}.`
          : "Bu dönem için gelir veya gider verisi yok."}
      </figcaption>

      {!hasData ? (
        <div
          className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center"
          role="status"
        >
          <p className="text-[13px] font-medium text-slate-500">
            Gelir veya gider kaydı oluştuğunda dağılım burada görünecek.
          </p>
        </div>
      ) : (
        <div className="flex h-[205px] min-w-0 items-center gap-7 max-md:h-auto max-md:flex-col max-md:gap-4">
          <div className="relative h-[165px] w-[165px] shrink-0 max-md:mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart aria-hidden="true">
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
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      stroke={entry.color}
                      strokeDasharray={entry.strokeDasharray}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[17px] font-extrabold leading-none tracking-[-0.03em] text-[#0f1f4d]">
                {formatMoney(data.profit)}
              </p>
              <p className="mt-1 text-[13px] font-bold leading-none text-slate-600">
                Kâr
              </p>
            </div>
          </div>

          <ul className="w-full max-w-[310px] space-y-4" aria-labelledby={summaryId}>
            {chartData.map((item) => (
              <li
                key={item.key}
                className="grid grid-cols-[12px_1fr_auto] items-center gap-3"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-slate-300"
                  style={{
                    backgroundColor: item.color,
                    backgroundImage: `repeating-linear-gradient(45deg, ${item.color}, ${item.color} 2px, transparent 2px, transparent 4px)`,
                  }}
                  aria-hidden="true"
                />

                <p className="truncate text-[13px] font-semibold text-[#24345f]">
                  {item.name}
                </p>

                <p className="whitespace-nowrap text-[13px] font-extrabold tracking-[-0.01em] text-[#0f1f4d]">
                  {formatMoney(item.value)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
