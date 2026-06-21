"use client";

import { Plus } from "lucide-react";

export function CalendarPageHeader() {
  return (
    <div className="min-w-0">
      <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
        Takvim
      </h1>
      <p className="text-[12px] font-medium text-slate-500">
        Ödemeleri, görevleri, izinleri ve önemli tarihleri takip edin.
      </p>
    </div>
  );
}

export function CalendarCreateButton({
  onCreate,
  className = "",
}: {
  onCreate: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className={[
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white transition hover:bg-[#162a5c]",
        className,
      ].join(" ")}
    >
      <Plus size={14} />
      Yeni Etkinlik
    </button>
  );
}
