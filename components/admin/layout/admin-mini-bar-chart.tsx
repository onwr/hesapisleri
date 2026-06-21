"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAdminMoney } from "@/lib/admin-utils";
import { appCardClass } from "@/lib/admin-ui";

type ChartPoint = {
  label: string;
  value: number;
};

type AdminMiniBarChartProps = {
  title: string;
  data: ChartPoint[];
  valueFormat?: "number" | "money";
  emptyMessage?: string;
};

function formatValue(value: number, format: "number" | "money") {
  if (format === "money") return formatAdminMoney(value);
  return String(value);
}

export function AdminMiniBarChart({
  title,
  data,
  valueFormat = "number",
  emptyMessage = "Bu dönemde veri oluşmadı.",
}: AdminMiniBarChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const hasData = total > 0;

  return (
    <div className={appCardClass}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[12px] font-bold text-[#24345f]/80">{title}</h3>
          <p className="mt-1 text-[18px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
            {formatValue(total, valueFormat)}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          7 gün
        </span>
      </div>

      {!hasData ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-[12px] font-medium text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                width={36}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value), valueFormat)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
