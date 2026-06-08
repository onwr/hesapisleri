"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { type InvoiceDistributionItem } from "@/lib/invoices-page-utils";

type InvoicesSidebarWidgetsProps = {
  distribution: InvoiceDistributionItem[];
  totalCount: number;
  fromLabel: string;
  toLabel: string;
};

export function InvoicesSidebarWidgets({
  distribution,
  totalCount,
  fromLabel,
  toLabel,
}: InvoicesSidebarWidgetsProps) {
  const chartData = distribution
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.label,
      value: item.count,
      color: item.color,
    }));

  const hasChartData = chartData.length > 0;

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
          Fatura Dağılımı
        </h3>
        <p className="mt-1 text-[10px] font-semibold text-slate-400">
          {fromLabel} - {toLabel}
        </p>

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
                  <p className="text-[18px] font-black leading-tight tracking-[-0.03em] text-[#0f1f4d]">
                    {totalCount}
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
            {distribution.map((item, index) => (
              <div
                key={item.label}
                className="animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                style={{ animationDelay: `${120 + index * 70}ms` }}
              >
                <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <p className="min-w-0 text-[11px] font-bold leading-snug text-[#24345f]">
                    {item.label}
                  </p>
                  <p className="whitespace-nowrap text-[10px] font-black text-slate-500">
                    {item.count} (%{item.percent})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "120ms" }}
      >
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">
          Hızlı Raporlar
        </h3>

        <div className="space-y-3">
          {[
            {
              title: "Fatura Özet Raporu",
              desc: "Finansal özet raporu",
              href: "/reports?tab=financial",
              icon: FileText,
              color: "bg-blue-50 text-blue-600",
            },
            {
              title: "Tahsilat Raporu",
              desc: "Ödenmiş faturaları görüntüle",
              href: "/invoices?tab=paid",
              icon: CheckCircle2,
              color: "bg-emerald-50 text-emerald-600",
            },
            {
              title: "Geciken Faturalar",
              desc: "Gecikmiş faturaları görüntüle",
              href: "/invoices?tab=overdue",
              icon: AlertTriangle,
              color: "bg-rose-50 text-rose-500",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-3 transition hover:opacity-80"
            >
              <div
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  item.color,
                ].join(" ")}
              >
                <Icon size={16} strokeWidth={2.4} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                  {item.title}
                </p>
                <p className="truncate text-[10px] font-semibold text-slate-400">
                  {item.desc}
                </p>
              </div>
            </Link>
            );
          })}
        </div>

        <Link
          href="/reports"
          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white text-[12px] font-black text-violet-600 shadow-sm"
        >
          Tüm Raporları Görüntüle
        </Link>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-orange-50 p-4 duration-500"
        style={{ animationDelay: "220ms" }}
      >
        <p className="text-[13px] font-black text-[#0f1f4d]">💡 İpuçları</p>

        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
          Faturalarınızı e-posta ile müşterilerinize gönderebilir, PDF olarak
          indirebilir veya yazdırabilirsiniz.
        </p>

        <Link
          href="/settings"
          className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm"
        >
          Fatura Ayarları
        </Link>
      </div>
    </>
  );
}
