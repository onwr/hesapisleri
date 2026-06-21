"use client";

import { ChevronLeft, ChevronRight, Filter, Plus } from "lucide-react";

export type CalendarViewMode = "month" | "week" | "list";

type CalendarToolbarProps = {
  periodLabel: string;
  viewMode: CalendarViewMode;
  onViewChange: (mode: CalendarViewMode) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  onOpenFilters?: () => void;
  onCreate?: () => void;
  activeFilterCount?: number;
};

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}) {
  const items: Array<{ mode: CalendarViewMode; label: string }> = [
    { mode: "month", label: "Ay" },
    { mode: "week", label: "Hafta" },
    { mode: "list", label: "Liste" },
  ];

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[12px]">
      {items.map((item) => (
        <button
          key={item.mode}
          type="button"
          onClick={() => onChange(item.mode)}
          className={[
            "rounded-md px-2.5 py-1.5 font-black transition",
            viewMode === item.mode
              ? "bg-white text-[#0f1f4d] shadow-sm"
              : "text-slate-500 hover:text-[#0f1f4d]",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function CalendarToolbar({
  periodLabel,
  viewMode,
  onViewChange,
  onPrevious,
  onToday,
  onNext,
  onOpenFilters,
  onCreate,
  activeFilterCount = 0,
}: CalendarToolbarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrevious}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Önceki dönem"
              title="Önceki"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[11px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
            >
              Bugün
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Sonraki dönem"
              title="Sonraki"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 className="min-w-0 flex-1 text-center text-sm font-extrabold capitalize text-[#0f1f4d] sm:text-base">
            {periodLabel}
          </h2>

          <div className="flex items-center gap-1.5 sm:ml-auto">
            {onOpenFilters ? (
              <button
                type="button"
                onClick={onOpenFilters}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-black text-[#0f1f4d]"
              >
                <Filter size={14} />
                <span className="hidden sm:inline">Filtreler</span>
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            {onCreate ? (
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0f1f4d] px-2.5 text-[11px] font-black text-white"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Yeni Etkinlik</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex justify-center sm:justify-end">
          <ViewToggle viewMode={viewMode} onChange={onViewChange} />
        </div>
      </div>
    </div>
  );
}
