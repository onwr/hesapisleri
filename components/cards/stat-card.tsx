import Link from "next/link";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  comparisonLabel?: string;
  changePercent?: number;
  highlight?: string;
  icon: ReactNode;
  color?: "green" | "blue" | "orange" | "purple" | "red";
  href?: string;
};

const colorMap = {
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-500",
  purple: "bg-violet-50 text-violet-600",
  red: "bg-rose-50 text-rose-500",
};

export function StatCard({
  title,
  value,
  subtitle,
  comparisonLabel,
  changePercent,
  highlight,
  icon,
  color = "blue",
  href,
}: StatCardProps) {
  const showChange =
    comparisonLabel !== undefined && changePercent !== undefined;
  const isPositive = (changePercent ?? 0) >= 0;

  const card = (
    <div
      className={[
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
        href ? "transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${colorMap[color]}`}
        >
          {icon}
        </div>

        {href ? (
          <ChevronRight size={16} className="text-[#0f1f4d]/70" />
        ) : null}
      </div>

      <p className="mt-4 text-xs font-bold text-[#24345f]">{title}</p>

      <p className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
        {value}
      </p>

      {highlight ? (
        <p className="mt-2 text-xs font-bold text-rose-600">
          {highlight}
        </p>
      ) : null}

      {showChange ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">
            {comparisonLabel}
          </span>

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
              isPositive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
            aria-label={`${isPositive ? "Artış" : "Azalış"} yüzde ${Math.abs(changePercent ?? 0)}`}
          >
            {isPositive ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
            <span aria-hidden="true">
              {isPositive ? "+" : ""}
              %{Math.abs(changePercent ?? 0)}
            </span>
          </span>
        </div>
      ) : subtitle ? (
        <p className="mt-3 text-xs font-medium text-slate-600">
          {subtitle}
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200">
        {card}
      </Link>
    );
  }

  return card;
}