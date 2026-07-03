"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format-utils";

function sanitizeChartNumber(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function sanitizeMonthlyFinancePoint(point: MonthlyFinancePoint): MonthlyFinancePoint {
  return {
    month: point.month,
    income: sanitizeChartNumber(point.income),
    expense: sanitizeChartNumber(point.expense),
    net: sanitizeChartNumber(point.net),
  };
}

export type MonthlyFinancePoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export type ExpenseCategoryPoint = {
  name: string;
  value: number;
  percent: number;
};

export type TopProductPoint = {
  name: string;
  soldQty: number;
  revenue: number;
};

const expenseColors = [
  "#8b5cf6",
  "#06b6d4",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#64748b",
];

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[210px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[12px] font-semibold text-slate-500">
      {message}
    </div>
  );
}

function DonutEmptyState({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex h-[170px] w-[170px] shrink-0 items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-center text-[11px] font-medium text-slate-400">
        Veri yok
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-500">
          Bu dönem için rapor verisi bulunmuyor.
        </p>
        <p className="mt-2 text-[17px] font-black text-[#0f1f4d]">
          {formatMoney(total)}
        </p>
      </div>
    </div>
  );
}

export function ReportMiniLine({
  data,
  color = "#22c55e",
}: {
  data: Array<{ value: number }>;
  color?: string;
}) {
  const chartData = data.length > 0 ? data : [{ value: 0 }];
  const safeData = chartData.map((point) => ({
    value: sanitizeChartNumber(point.value),
  }));

  return (
    <div className="h-12 w-24">
      <LineChart width={96} height={48} data={safeData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.2}
          dot={false}
        />
      </LineChart>
    </div>
  );
}

export function FinanceBarChart({ data }: { data: MonthlyFinancePoint[] }) {
  const chartData = data.map(sanitizeMonthlyFinancePoint);
  if (chartData.length === 0) {
    return <ChartEmptyState message="Bu dönem için rapor verisi bulunmuyor." />;
  }

  return (
    <div className="h-[210px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={chartData} barGap={8} barCategoryGap={24}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(value) => `₺${Math.round(Number(value) / 1000)}.000`}
            width={52}
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
          <Bar dataKey="income" name="Gelir" fill="#22c55e" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Gider" fill="#fb7185" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({ data }: { data: MonthlyFinancePoint[] }) {
  const chartData = data.map(sanitizeMonthlyFinancePoint);
  if (chartData.length === 0) {
    return <ChartEmptyState message="Bu dönem için rapor verisi bulunmuyor." />;
  }

  return (
    <div className="h-[210px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={chartData} barGap={6} barCategoryGap={18}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(value) => `₺${Math.round(Number(value) / 1000)}.000`}
            width={52}
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
          <Bar dataKey="income" name="Nakit Girişi" fill="#22c55e" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Nakit Çıkışı" fill="#fb7185" radius={[6, 6, 0, 0]} />
          <Line
            type="monotone"
            dataKey="net"
            name="Net Nakit"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#2563eb" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseDonutChart({
  data,
  total,
}: {
  data: ExpenseCategoryPoint[];
  total: number;
}) {
  if (data.length === 0) {
    return <DonutEmptyState total={total} />;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[170px] w-[170px] shrink-0">
        <PieChart width={170} height={170}>
          <Pie
            data={data}
            dataKey="value"
            cx={85}
            cy={85}
            innerRadius={54}
            outerRadius={82}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={expenseColors[index % expenseColors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatMoney(Number(value))}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
              fontSize: 12,
            }}
          />
        </PieChart>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[17px] font-black tracking-[-0.03em] text-[#0f1f4d]">
            {formatMoney(total)}
          </p>
          <p className="text-[10px] font-bold text-slate-500">Toplam</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {data.slice(0, 5).map((item, index) => (
          <div
            key={item.name}
            className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: expenseColors[index % expenseColors.length] }}
            />
            <p className="truncate text-[12px] font-bold text-[#24345f]">
              {item.name}
            </p>
            <p className="text-[11px] font-black text-[#0f1f4d]">
              {formatMoney(item.value)}
            </p>
            <p className="text-[10px] font-bold text-slate-400">
              %{item.percent}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StockReportTable({
  data,
}: {
  data: Array<{
    id?: string;
    name: string;
    stock: number;
    minStock: number;
    buyPrice: number;
    stockValue: number;
    isLowStock: boolean;
  }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[12px] font-semibold text-slate-500">
        Stok takipli ürün bulunmuyor.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
            <th className="px-4 py-3">Ürün</th>
            <th className="px-4 py-3">Stok</th>
            <th className="px-4 py-3">Min. Stok</th>
            <th className="px-4 py-3 text-right">Stok Değeri</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr key={item.id ?? item.name} className="text-[12px] font-semibold text-[#24345f]">
              <td className="px-4 py-3 font-extrabold text-[#0f1f4d]">
                {item.name}
                {item.isLowStock ? (
                  <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                    Düşük
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">{item.stock}</td>
              <td className="px-4 py-3">{item.minStock}</td>
              <td className="px-4 py-3 text-right font-black text-[#0f1f4d]">
                {formatMoney(item.stockValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopProductsTable({ data }: { data: TopProductPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-[12px] font-semibold text-slate-500">
        Bu dönem için rapor verisi bulunmuyor.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
            <th className="px-4 py-3">Ürün</th>
            <th className="px-4 py-3">Satış Adedi</th>
            <th className="px-4 py-3 text-right">Ciro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, index) => (
            <tr key={item.name} className="text-[12px] font-semibold text-[#24345f]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-black text-blue-600">
                    {index + 1}
                  </div>
                  <span className="font-extrabold text-[#0f1f4d]">{item.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">{item.soldQty} adet</td>
              <td className="px-4 py-3 text-right font-black text-[#0f1f4d]">
                {formatMoney(item.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
