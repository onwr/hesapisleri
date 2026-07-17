"use client";

import {
  buildPosSummaryMetrics,
  getPosMetricColorClass,
} from "@/lib/pos-page-ui-utils";

type PosSummaryMetricsProps = {
  todaySalesCount: number;
  todaySalesTotal: number;
  todayCashTotal?: number;
  todayCardTotal?: number;
  cartTotal: number;
  cartLineCount: number;
  cartItemCount: number;
};

export function PosSummaryMetrics({
  todaySalesCount,
  todaySalesTotal,
  todayCashTotal,
  todayCardTotal,
  cartTotal,
  cartLineCount,
  cartItemCount,
}: PosSummaryMetricsProps) {
  const metrics = buildPosSummaryMetrics({
    todaySalesCount,
    todaySalesTotal,
    todayCashTotal,
    todayCardTotal,
    cartTotal,
    cartLineCount,
    cartItemCount,
  });

  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.key}
            className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-[#24345f]/80">
                  {metric.label}
                </p>
                <p className="mt-2 text-[18px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                  {metric.value}
                </p>
                {metric.subtitle ? (
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">
                    {metric.subtitle}
                  </p>
                ) : null}
              </div>

              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  getPosMetricColorClass(metric.color),
                ].join(" ")}
              >
                <Icon size={18} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
