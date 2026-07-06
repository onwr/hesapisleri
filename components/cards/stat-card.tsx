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

const iconChipMap = {
  green: "bg-linear-to-br from-emerald-500 to-green-600 shadow-emerald-500/30",
  blue: "bg-linear-to-br from-sky-400 to-blue-600 shadow-blue-500/30",
  orange: "bg-linear-to-br from-amber-400 to-orange-600 shadow-orange-500/30",
  purple: "bg-linear-to-br from-violet-500 to-purple-600 shadow-violet-500/30",
  red: "bg-linear-to-br from-rose-500 to-red-600 shadow-rose-500/30",
};

const cardTintMap = {
  green: "from-emerald-50/80 via-white to-white",
  blue: "from-blue-50/80 via-white to-white",
  orange: "from-orange-50/80 via-white to-white",
  purple: "from-violet-50/80 via-white to-white",
  red: "from-rose-50/80 via-white to-white",
};

const accentBarMap = {
  green: "bg-linear-to-r from-emerald-400 to-green-500",
  blue: "bg-linear-to-r from-sky-400 to-blue-500",
  orange: "bg-linear-to-r from-amber-400 to-orange-500",
  purple: "bg-linear-to-r from-violet-400 to-purple-500",
  red: "bg-linear-to-r from-rose-400 to-red-500",
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
        "relative overflow-hidden rounded-2xl border border-slate-200/70 bg-linear-to-br p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]",
        cardTintMap[color],
        href
          ? "transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]"
          : "",
      ].join(" ")}
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 ${accentBarMap[color]}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${iconChipMap[color]}`}
        >
          {icon}
        </div>

        {href ? (
          <ChevronRight size={16} className="mt-1 text-[#0f1f4d]/50" />
        ) : null}
      </div>

      <p className="mt-4 text-xs font-bold text-[#24345f]">{title}</p>

      <p className="mt-1 text-[21px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
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
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
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
