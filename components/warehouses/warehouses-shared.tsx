import type { ReactNode } from "react";

export function WarehouseBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "blue" | "emerald" | "slate" | "amber" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : tone === "rose"
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-100 text-slate-600";

  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${toneClass}`}>
      {children}
    </span>
  );
}

export function WarehouseStatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "blue" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700"
          : tone === "rose"
            ? "bg-rose-50 text-rose-700"
            : "bg-slate-50 text-slate-700";

  return (
    <div className={`shrink-0 rounded-lg px-2.5 py-1.5 ${toneClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <p className="max-w-[140px] truncate text-[13px] font-black leading-tight sm:max-w-none">
        {value}
      </p>
    </div>
  );
}
