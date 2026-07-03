"use client";

import { Info } from "lucide-react";

type Props = {
  text: string;
  className?: string;
};

export function AdminPlanInfoTip({ text, className }: Props) {
  return (
    <span
      className={["group relative inline-flex align-middle", className].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Bilgi"
        tabIndex={0}
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-normal leading-snug text-slate-600 shadow-md group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
