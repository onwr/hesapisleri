"use client";

import type { LucideIcon } from "lucide-react";
import { CalendarOff, Plus } from "lucide-react";

type CalendarEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function CalendarEmptyState({
  title,
  description,
  icon: Icon = CalendarOff,
  compact = false,
  actionLabel,
  onAction,
}: CalendarEmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center",
        compact ? "px-4 py-8" : "px-6 py-12",
      ].join(" ")}
    >
      <div
        className={[
          "mb-3 flex items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm",
          compact ? "h-10 w-10" : "h-14 w-14",
        ].join(" ")}
      >
        <Icon size={compact ? 18 : 24} strokeWidth={1.75} />
      </div>
      <p
        className={[
          "font-extrabold text-[#0f1f4d]",
          compact ? "text-xs" : "text-sm",
        ].join(" ")}
      >
        {title}
      </p>
      {description ? (
        <p
          className={[
            "mt-1.5 max-w-xs leading-relaxed text-slate-500",
            compact ? "text-[11px]" : "text-xs",
          ].join(" ")}
        >
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-[#0f1f4d] px-4 text-xs font-black text-white transition hover:bg-[#162a5c]"
        >
          <Plus size={14} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
