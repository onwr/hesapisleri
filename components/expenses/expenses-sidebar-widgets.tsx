"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  formatExpenseMoney,
  getCategoryIconStyle,
  type ExpenseCategoryBreakdown,
} from "@/lib/expenses-page-utils";

type ExpensesSidebarWidgetsProps = {
  monthlyBreakdown: ExpenseCategoryBreakdown[];
  categoryBreakdown: ExpenseCategoryBreakdown[];
  monthlyTotal: number;
};

export function ExpensesSidebarWidgets({
  monthlyBreakdown,
  categoryBreakdown,
  monthlyTotal,
}: ExpensesSidebarWidgetsProps) {
  const chartData = monthlyBreakdown
    .filter((item) => item.total > 0)
    .map((item) => ({
      name: item.category,
      value: item.total,
      color: item.color,
    }));

  const hasChartData = chartData.length > 0;

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
          Gider Dağılımı (Bu Ay)
        </h3>

        <div className="mt-4 grid grid-cols-[148px_minmax(0,1fr)] items-center gap-4">
          <div className="relative mx-auto h-[148px] w-[148px] shrink-0 sm:mx-0">
            {hasChartData ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="#ffffff"
                      strokeWidth={2}
                      isAnimationActive
                      animationBegin={0}
                      animationDuration={900}
                      animationEasing="ease-out"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                  <p className="text-[13px] font-black leading-tight tracking-[-0.03em] text-[#0f1f4d]">
                    {formatExpenseMoney(monthlyTotal)}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">Toplam</p>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400">
                Veri yok
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-2.5">
            {hasChartData ? (
              chartData.map((item, index) => (
                <div
                  key={item.name}
                  className="animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0.5">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="min-w-0 text-[11px] font-bold leading-snug text-[#24345f]">
                      {item.name}
                    </p>
                    <p className="whitespace-nowrap text-[11px] font-black text-[#0f1f4d]">
                      {formatExpenseMoney(item.value)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-medium text-slate-500">
                Bu ay henüz gider kaydı yok.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "120ms" }}
      >
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">
          Kategoriye Göre Giderler
        </h3>

        <div className="space-y-3">
          {categoryBreakdown.length > 0 ? (
            categoryBreakdown.slice(0, 7).map((item, index) => (
              <div
                key={item.category}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                style={{ animationDelay: `${180 + index * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        getCategoryIconStyle(item.category),
                      ].join(" ")}
                    >
                      <ReceiptText size={13} strokeWidth={2.4} />
                    </span>

                    <p className="min-w-0 text-[11px] font-bold leading-snug text-[#24345f]">
                      {item.category}
                    </p>
                  </div>

                  <p className="shrink-0 whitespace-nowrap text-[11px] font-black text-[#0f1f4d]">
                    {formatExpenseMoney(item.total)}
                  </p>
                </div>

                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.max(item.percent, 4)}%`,
                      backgroundColor: item.color,
                      transitionDelay: `${220 + index * 60}ms`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-[11px] font-medium text-slate-500">
              Kategori verisi bulunamadı.
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-orange-50 p-4 duration-500"
        style={{ animationDelay: "220ms" }}
      >
        <p className="text-[13px] font-black text-[#0f1f4d]">💡 İpucu</p>
        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
          Düzenli giderlerinizi “Düzenli Giderler” sekmesinden kaydedebilir,
          otomatik hatırlatmalar alabilirsiniz.
        </p>

        <Link
          href="/expenses?tab=recurring"
          className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm transition hover:bg-slate-50"
        >
          Düzenli Giderleri Gör
        </Link>
      </div>
    </>
  );
}
