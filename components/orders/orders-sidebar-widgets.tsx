"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { MarketplaceLogo } from "@/components/orders/marketplace-logo";
import {
  MARKETPLACE_INTEGRATIONS,
  type OrderChannelBreakdown,
  type OrderIntegrationActivity,
} from "@/lib/orders-page-utils";

type OrdersSidebarWidgetsProps = {
  channelBreakdown: OrderChannelBreakdown[];
  integrationActivities: OrderIntegrationActivity[];
  totalCount: number;
  integrationOrderCounts: Record<string, number>;
  integrationStatuses: Record<
    string,
    { status: string; lastSyncAt: Date | string | null }
  >;
};

export function OrdersSidebarWidgets({
  channelBreakdown,
  integrationActivities,
  totalCount,
  integrationOrderCounts,
  integrationStatuses,
}: OrdersSidebarWidgetsProps) {
  const chartData = channelBreakdown
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.name,
      value: item.count,
      color: item.color,
    }));

  const hasChartData = chartData.length > 0;

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
            Pazaryeri Kanalları
          </h3>
        </div>

        <div className="space-y-3">
          {MARKETPLACE_INTEGRATIONS.map((integration) => {
            const orderCount = integrationOrderCounts[integration.key] ?? 0;
            const connection = integrationStatuses[integration.key];
            const isConnected = connection?.status === "CONNECTED";
            const lastSyncText = connection?.lastSyncAt
              ? new Date(connection.lastSyncAt).toLocaleString("tr-TR")
              : null;

            return (
              <div key={integration.key} className="flex items-center gap-3">
                <MarketplaceLogo channel={integration.key} className="h-8 w-8" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                    {integration.name}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {isConnected
                      ? lastSyncText
                        ? `Son senkronizasyon: ${lastSyncText}`
                        : "Bağlı · senkronizasyon bekleniyor"
                      : orderCount > 0
                        ? `${orderCount} sipariş bu dönemde`
                        : "Bağlı değil"}
                  </p>
                </div>

                <span
                  className={[
                    "rounded-md px-2 py-1 text-[10px] font-black",
                    isConnected
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {isConnected ? "Bağlı" : "Bağlı değil"}
                </span>
              </div>
            );
          })}

          {(["MANUAL", "POS"] as const).map((channel) => {
            const orderCount = integrationOrderCounts[channel] ?? 0;
            if (orderCount === 0) return null;

            return (
              <div key={channel} className="flex items-center gap-3">
                <MarketplaceLogo channel={channel} className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                    {channel === "MANUAL" ? "Manuel Satış" : "POS"}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {orderCount} sipariş bu dönemde
                  </p>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                  Dahili
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "120ms" }}
      >
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">
          En Çok Sipariş Gelen Kanallar
        </h3>

        <div className="grid grid-cols-[148px_minmax(0,1fr)] items-center gap-4">
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
            {channelBreakdown.length > 0 ? (
              channelBreakdown.map((item, index) => (
                <div
                  key={item.key}
                  className="animate-in fade-in slide-in-from-right-2 fill-mode-both duration-500"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-2">
                    {item.logo ? (
                      <MarketplaceLogo channel={item.key} className="h-7 w-7" />
                    ) : (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    )}
                    <p className="min-w-0 truncate text-[11px] font-bold text-[#24345f]">
                      {item.name}
                    </p>
                    <p className="whitespace-nowrap text-[10px] font-black text-slate-500">
                      %{item.percent}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-medium text-slate-500">
                Seçili dönemde kanal verisi yok.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "220ms" }}
      >
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">
          Son Entegrasyon Aktiviteleri
        </h3>

        <div className="space-y-3">
          {integrationActivities.length > 0 ? (
            integrationActivities.map((activity) => (
              <div key={activity.key} className="flex items-center gap-3">
                <MarketplaceLogo channel={activity.key} className="h-8 w-8" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                    {activity.name}
                  </p>
                  <p className="truncate text-[10px] font-semibold text-slate-400">
                    {activity.timeLabel}
                  </p>
                </div>

                <p className="shrink-0 text-[10px] font-black text-blue-600">
                  {activity.description}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-medium text-slate-500">
              Henüz entegrasyon aktivitesi yok
            </p>
          )}
        </div>

        <Link
          href="/settings/integrations"
          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white text-[12px] font-black text-violet-600 shadow-sm"
        >
          Entegrasyonları Yönet
          <ArrowRight size={14} strokeWidth={3} />
        </Link>
      </div>
    </>
  );
}
