"use client";

import { useState, type ReactNode } from "react";
import { Filter, X } from "lucide-react";

type MobileFilterSheetProps = {
  children: ReactNode;
  activeFilterCount?: number;
  onApply?: () => void;
  onClear?: () => void;
};

/**
 * Mobilde filtre alanlarını bir bottom-sheet içinde gösterir.
 * - Masaüstünde hiçbir şey render etmez (filtreler inline gösterilmeli).
 * - Mobilde "Filtrele" butonu açar, içeride children render edilir.
 */
export function MobileFilterSheet({
  children,
  activeFilterCount = 0,
  onApply,
  onClear,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  function handleApply() {
    onApply?.();
    setOpen(false);
  }

  function handleClear() {
    onClear?.();
    setOpen(false);
  }

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 min-w-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-[#0f1f4d] shadow-sm transition hover:bg-slate-50"
        aria-label="Filtreleri aç"
      >
        <Filter size={15} />
        Filtrele
        {activeFilterCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[55] flex flex-col">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div className="relative mt-auto flex max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-[15px] font-black text-[#0f1f4d]">
                Filtrele
                {activeFilterCount > 0 ? (
                  <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">
                    {activeFilterCount} aktif
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Filtreleri kapat"
              >
                <X size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

            <div className="shrink-0 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-11 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Temizle
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="h-11 rounded-xl bg-blue-600 text-[13px] font-bold text-white transition hover:bg-blue-700"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
