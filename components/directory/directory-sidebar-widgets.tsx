"use client";

import {
  BookUser,
  Download,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import {
  buildDirectoryDistribution,
  type DirectoryDistributionItem,
  type DirectoryQuickActionKey,
} from "@/lib/directory-page-ui-utils";
import type { DirectorySummary } from "@/lib/directory-service";

type DirectorySidebarWidgetsProps = {
  summary: DirectorySummary;
  canManage: boolean;
  exportHref: string;
  onAction: (key: DirectoryQuickActionKey) => void;
};

export function DirectorySidebarWidgets({
  summary,
  canManage,
  exportHref,
  onAction,
}: DirectorySidebarWidgetsProps) {
  const distribution = buildDirectoryDistribution(summary);
  const chartData = distribution
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.label,
      value: item.count,
      color: item.color,
    }));

  const hasChartData = chartData.length > 0;

  const quickActions = [
    canManage
      ? {
          key: "new-person" as const,
          title: "Yeni Kişi Ekle",
          icon: UserPlus,
          color: "bg-emerald-50 text-emerald-600",
        }
      : null,
    canManage
      ? {
          key: "sync-customers" as const,
          title: "Müşterileri Senkronize Et",
          icon: Users,
          color: "bg-cyan-50 text-cyan-600",
        }
      : null,
    canManage
      ? {
          key: "sync-suppliers" as const,
          title: "Tedarikçileri Senkronize Et",
          icon: Truck,
          color: "bg-violet-50 text-violet-600",
        }
      : null,
    canManage
      ? {
          key: "sync-employees" as const,
          title: "Çalışanları Senkronize Et",
          icon: BookUser,
          color: "bg-amber-50 text-amber-600",
        }
      : null,
    {
      key: "export" as const,
      title: "CSV Dışa Aktar",
      icon: Download,
      color: "bg-rose-50 text-rose-500",
      href: exportHref,
    },
  ].filter(Boolean) as Array<{
    key: DirectoryQuickActionKey;
    title: string;
    icon: typeof UserPlus;
    color: string;
    href?: string;
  }>;

  return (
    <>
      <DistributionPanel
        distribution={distribution}
        chartData={chartData}
        hasChartData={hasChartData}
        totalCount={summary.total}
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h3 className="mb-4 text-[14px] font-extrabold text-[#0f1f4d]">
          Hızlı İşlemler
        </h3>

        <div className="space-y-3">
          {quickActions.map((item) => {
            const Icon = item.icon;

            const content = (
              <>
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
                </div>
              </>
            );

            if (item.href) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 transition hover:opacity-80"
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onAction(item.key)}
                className="flex w-full items-center gap-3 text-left transition hover:opacity-80"
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-orange-50 p-4">
        <p className="text-[13px] font-black text-[#0f1f4d]">İpuçları</p>
        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
          Fihrist kayıtlarını müşteri, tedarikçi ve çalışan kartlarından
          senkronize edebilirsiniz.
        </p>
      </div>
    </>
  );
}

function DistributionPanel({
  distribution,
  chartData,
  hasChartData,
  totalCount,
}: {
  distribution: DirectoryDistributionItem[];
  chartData: Array<{ name: string; value: number; color: string }>;
  hasChartData: boolean;
  totalCount: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">
        Fihrist Dağılımı
      </h3>
      <p className="mt-1 text-[10px] font-semibold text-slate-400">
        Aktif kayıtlar
      </p>

      <div className="mt-4 grid grid-cols-[148px_minmax(0,1fr)] items-center gap-4">
        <div className="relative mx-auto h-[148px] w-[148px] shrink-0 sm:mx-0">
          {hasChartData ? (
            <>
              <PieChart width={148} height={148}>
                <Pie
                  data={chartData}
                  cx={74}
                  cy={74}
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <p className="text-[18px] font-black leading-tight tracking-[-0.03em] text-[#0f1f4d]">
                  {totalCount}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  Toplam
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400">
              Veri yok
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-2.5">
          {distribution.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2"
            >
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
          ))}
        </div>
      </div>
    </div>
  );
}
