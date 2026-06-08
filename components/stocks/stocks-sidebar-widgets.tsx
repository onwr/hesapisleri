"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  RefreshCcw,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  formatStockDateTime,
  formatStockNumber,
  getMovementSoftClass,
  getMovementText,
  type StockCategoryItem,
  type StockDistributionItem,
  type StockMovementRow,
} from "@/lib/stocks-page-utils";

type StocksSidebarWidgetsProps = {
  distribution: StockDistributionItem[];
  categoryTotals: StockCategoryItem[];
  recentMovements: StockMovementRow[];
  totalStock: number;
};

function getMovementIcon(type: string) {
  if (type === "IN" || type === "RETURN") {
    return <ArrowDownLeft size={15} strokeWidth={2.6} />;
  }

  if (type === "OUT" || type === "SALE") {
    return <ArrowUpRight size={15} strokeWidth={2.6} />;
  }

  return <RefreshCcw size={15} strokeWidth={2.6} />;
}

export function StocksSidebarWidgets({
  distribution,
  categoryTotals,
  recentMovements,
  totalStock,
}: StocksSidebarWidgetsProps) {
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
          Stok Dağılımı
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
                  <p className="text-[16px] font-black leading-tight tracking-[-0.03em] text-[#0f1f4d]">
                    {formatStockNumber(totalStock)}
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
                  <div className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2">
                    <span
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="min-w-0 text-[11px] font-bold leading-snug text-[#24345f]">
                      {item.name}
                    </p>
                    <p className="whitespace-nowrap text-[10px] font-black text-slate-500">
                      {item.value} (%{distribution.find((d) => d.label === item.name)?.percent ?? 0})
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-medium text-slate-500">
                Henüz stok verisi yok.
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
          Kategoriye Göre Stok
        </h3>

        <div className="space-y-3">
          {categoryTotals.length > 0 ? (
            categoryTotals.map((item, index) => (
              <div
                key={item.category}
                className="animate-in fade-in slide-in-from-right-2 fill-mode-both flex items-center justify-between gap-3 duration-500"
                style={{ animationDelay: `${160 + index * 60}ms` }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      item.badgeClass,
                    ].join(" ")}
                  >
                    <Package size={13} strokeWidth={2.4} />
                  </span>

                  <p className="truncate text-[11px] font-bold text-[#24345f]">
                    {item.category}
                  </p>
                </div>

                <p className="shrink-0 text-[11px] font-black text-[#0f1f4d]">
                  {item.stock} adet
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-medium text-slate-500">
              Kategori verisi bulunmuyor
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-500"
        style={{ animationDelay: "220ms" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
            Son Stok Hareketleri
          </h3>

          <Link
            href="/stocks?tab=movements"
            className="text-[11px] font-black text-blue-600 hover:text-blue-700"
          >
            Tümünü Gör
          </Link>
        </div>

        <div className="space-y-3">
          {recentMovements.length > 0 ? (
            recentMovements.map((movement, index) => (
              <div
                key={movement.id}
                className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-3 duration-500"
                style={{ animationDelay: `${180 + index * 50}ms` }}
              >
                <div
                  className={[
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    getMovementSoftClass(movement.type),
                  ].join(" ")}
                >
                  {getMovementIcon(movement.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-extrabold text-[#0f1f4d]">
                    {movement.productName}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                    {getMovementText(movement.type)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={[
                      "text-[11px] font-black",
                      movement.quantity > 0 ? "text-emerald-600" : "text-rose-500",
                    ].join(" ")}
                  >
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                    {formatStockDateTime(movement.createdAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] font-medium text-slate-500">
              Henüz hareket yok
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-blue-50 p-4 duration-500"
        style={{ animationDelay: "300ms" }}
      >
        <p className="text-[13px] font-black text-[#0f1f4d]">💡 İpucu</p>
        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
          Kritik stok seviyelerini düzenli takip ederek satış kaybını önleyebilir,
          stok girişlerini zamanında planlayabilirsiniz.
        </p>

        <Link
          href="/settings"
          className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-white px-3 text-[11px] font-black text-blue-600 shadow-sm"
        >
          Stok Ayarları
        </Link>
      </div>
    </>
  );
}
