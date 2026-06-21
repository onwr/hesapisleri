"use client";

import { useState } from "react";
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  CALENDAR_INPUT_CLASS,
} from "@/components/calendar/calendar-ui-tokens";
import type { CalendarExtendedFilterState } from "@/lib/calendar-ui-utils";

type CalendarFiltersProps = {
  filters: CalendarExtendedFilterState;
  onChange: (filters: CalendarExtendedFilterState) => void;
  embedded?: boolean;
};

const TYPE_ITEMS: Array<{
  key: "showPayments" | "showAppointments" | "showReminders";
  label: string;
  icon: typeof Wallet;
  activeClass: string;
  idleClass: string;
}> = [
  {
    key: "showPayments",
    label: "Ödeme",
    icon: Wallet,
    activeClass:
      "border-orange-200/90 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100/60",
    idleClass:
      "border-slate-200/90 bg-white text-slate-500 hover:border-orange-100 hover:bg-orange-50/40",
  },
  {
    key: "showAppointments",
    label: "Randevu",
    icon: Calendar,
    activeClass:
      "border-blue-200/90 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/60",
    idleClass:
      "border-slate-200/90 bg-white text-slate-500 hover:border-blue-100 hover:bg-blue-50/40",
  },
  {
    key: "showReminders",
    label: "Hatırlatma",
    icon: Bell,
    activeClass:
      "border-violet-200/90 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/60",
    idleClass:
      "border-slate-200/90 bg-white text-slate-500 hover:border-violet-100 hover:bg-violet-50/40",
  },
];

export function CalendarFilters({
  filters,
  onChange,
  embedded = false,
}: CalendarFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(true);

  function update<K extends keyof CalendarExtendedFilterState>(
    key: K,
    value: CalendarExtendedFilterState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  const filterBody = (
    <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Etkinlik tipi
          </p>
          <div className="flex flex-wrap gap-2">
            {TYPE_ITEMS.map((item) => {
              const active = filters[item.key];
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => update(item.key, !filters[item.key])}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition",
                    active ? item.activeClass : item.idleClass,
                  ].join(" ")}
                  aria-pressed={active}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Kaynak
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ALL", "Tümü"],
                ["MANUAL", "Manuel"],
                ["SYSTEM", "Sistem"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => update("sourceFilter", value)}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition",
                  filters.sourceFilter === value
                    ? "border-slate-300/90 bg-slate-100 text-slate-700"
                    : "border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50",
                ].join(" ")}
              >
                {value === "SYSTEM" ? <Sparkles size={14} /> : null}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Arama
          </p>
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={filters.searchQuery}
              onChange={(e) => update("searchQuery", e.target.value)}
              placeholder="Başlık veya açıklama ara..."
              className={`${CALENDAR_INPUT_CLASS} pl-11`}
            />
          </div>
        </div>

        {advancedOpen ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Durum
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ALL", "Tümü"],
                    ["UPCOMING", "Yaklaşan"],
                    ["TODAY", "Bugün"],
                    ["OVERDUE", "Geciken"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("statusFilter", value)}
                    className={[
                      "rounded-2xl border px-3 py-2 text-xs font-bold transition",
                      filters.statusFilter === value
                        ? value === "OVERDUE"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Modül
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["ALL", "Tümü"],
                    ["FINANCE", "Finans"],
                    ["EMPLOYEE", "Çalışan"],
                    ["PAYROLL", "Bordro"],
                    ["INVOICE", "Fatura"],
                    ["EXPENSE", "Gider"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update("moduleFilter", value)}
                    className={[
                      "rounded-2xl border px-3 py-2 text-xs font-bold transition",
                      filters.moduleFilter === value
                        ? "border-violet-200 bg-violet-50 text-violet-700"
                        : "border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Tarih aralığı
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => update("dateFrom", e.target.value)}
                  className={CALENDAR_INPUT_CLASS}
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => update("dateTo", e.target.value)}
                  className={CALENDAR_INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Sistem etkinlikleri
              </p>
              <button
                type="button"
                onClick={() => update("showSystem", !filters.showSystem)}
                className={[
                  "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition",
                  filters.showSystem
                    ? "border-slate-300/90 bg-slate-100 text-slate-700"
                    : "border-slate-200/90 bg-white text-slate-500",
                ].join(" ")}
              >
                <Sparkles size={14} />
                {filters.showSystem ? "Sistem açık" : "Sistem kapalı"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
  );

  if (embedded) {
    return filterBody;
  }

  return null;
}
