import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { appCardClass } from "@/lib/admin-ui";
import {
  getAdminStatToneClass,
  type AdminStatTone,
} from "@/lib/admin-stat-card-utils";

export type { AdminStatTone };

export type AdminStatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: AdminStatTone;
  changePercent?: number;
  comparisonLabel?: string;
  highlight?: string;
  href?: string;
  ariaLabel?: string;
};

export function AdminStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
  changePercent,
  comparisonLabel,
  highlight,
  href,
  ariaLabel,
}: AdminStatCardProps) {
  const showChange =
    comparisonLabel !== undefined && changePercent !== undefined;
  const isPositive = (changePercent ?? 0) >= 0;

  const card = (
    <div
      className={[
        appCardClass,
        href ? "transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${getAdminStatToneClass(tone)}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        {href ? (
          <ChevronRight size={16} className="shrink-0 text-[#0f1f4d]/50" aria-hidden />
        ) : null}
      </div>

      <p className="mt-4 text-[12px] font-bold text-[#24345f]/80">{title}</p>
      <p className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
        {value}
      </p>

      {highlight ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{highlight}</p>
      ) : null}

      {showChange ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {comparisonLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
              isPositive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {isPositive ? "+" : ""}
            %{Math.abs(changePercent ?? 0).toFixed(1)}
          </span>
        </div>
      ) : description ? (
        <p className="mt-3 text-[11px] font-medium text-slate-500">{description}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel ?? `${title}: ${value}`}
        className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
      >
        {card}
      </Link>
    );
  }

  return card;
}
