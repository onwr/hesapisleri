"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type CalendarActionButtonProps = {
  title: string;
  description: string;
  onClick: () => void;
  icon: ReactNode;
  gradient: string;
};

export function CalendarActionButton({
  title,
  description,
  onClick,
  icon,
  gradient,
}: CalendarActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-[86px] w-full items-center justify-between rounded-2xl p-4 text-left text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] ${gradient}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold leading-tight">
            {title}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-white/85">
            {description}
          </p>
        </div>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 opacity-80 transition group-hover:translate-x-1 group-hover:opacity-100"
      />
    </button>
  );
}
