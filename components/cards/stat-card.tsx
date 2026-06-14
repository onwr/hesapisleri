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

        <ChevronRight size={16} className="text-[#0f1f4d]/70" />
      </div>

      <p className="mt-4 text-[12px] font-bold text-[#24345f]/80">{title}</p>

      <p className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-[#0f1f4d]">
        {value}
      </p>

      {highlight ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">
          {highlight}
        </p>
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
            %{Math.abs(changePercent ?? 0)}
          </span>
        </div>
      ) : subtitle ? (
        <p className="mt-3 text-[11px] font-medium text-slate-500">
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