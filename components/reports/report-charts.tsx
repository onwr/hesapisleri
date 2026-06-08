"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export function ReportMiniLine({
  data,
  color = "#22c55e",
}: {
  data: Array<{ value: number }>;
  color?: string;
}) {
  return (
    <div className="h-12 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinanceBarChart({ data }: { data: MonthlyFinancePoint[] }) {
  return (
    <div className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={8} barCategoryGap={24}>
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
  return (
    <div className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6} barCategoryGap={18}>
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
        </BarChart>
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
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[170px] w-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={82}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={expenseColors[index % expenseColors.length]} />
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
        </ResponsiveContainer>

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

export function TopProductsTable({ data }: { data: TopProductPoint[] }) {
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