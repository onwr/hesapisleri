import type { CalendarEventStatus } from "@prisma/client";
import type { CalendarEventColorKey } from "@/lib/calendar-ui-utils";

export const CALENDAR_CARD_CLASS =
  "rounded-xl border border-slate-200/80 bg-white shadow-sm";

export const CALENDAR_STATS_BAR_CLASS =
  "flex flex-wrap items-stretch gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm";

export const CALENDAR_FILTER_CARD_CLASS =
  "rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm";

export const CALENDAR_LIST_ROW_CLASS =
  "flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 px-4 py-3.5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between lg:px-5";

export const CALENDAR_INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-semibold text-[#0f1f4d] outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

export function getEventDotClass(color: string) {
  const map: Record<string, string> = {
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    purple: "bg-violet-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
    slate: "bg-slate-500",
  };
  return map[color] ?? map.blue;
}

export function getEventPillClass(color: string) {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100/80",
    orange: "bg-orange-50 text-orange-700 ring-orange-100/80",
    purple: "bg-violet-50 text-violet-700 ring-violet-100/80",
    violet: "bg-violet-50 text-violet-700 ring-violet-100/80",
    amber: "bg-amber-50 text-amber-800 ring-amber-100/80",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
    rose: "bg-rose-50 text-rose-700 ring-rose-100/80",
    sky: "bg-sky-50 text-sky-700 ring-sky-100/80",
    slate: "bg-slate-100 text-slate-700 ring-slate-200/80",
  };
  return map[color] ?? map.blue;
}

export function getEventAccentClass(color: string) {
  const map: Record<string, string> = {
    blue: "from-blue-500 to-blue-600",
    orange: "from-orange-400 to-orange-600",
    purple: "from-violet-500 to-purple-600",
    violet: "from-violet-500 to-purple-600",
    amber: "from-amber-400 to-amber-600",
    emerald: "from-emerald-500 to-emerald-600",
    rose: "from-rose-400 to-rose-600",
    sky: "from-sky-400 to-sky-600",
    slate: "from-slate-400 to-slate-600",
  };
  return map[color] ?? map.blue;
}

export function getTypeBadgeClass(color: string | CalendarEventColorKey) {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100/80",
    orange: "bg-orange-50 text-orange-700 border-orange-100/80",
    purple: "bg-violet-50 text-violet-700 border-violet-100/80",
    violet: "bg-violet-50 text-violet-700 border-violet-100/80",
    amber: "bg-amber-50 text-amber-700 border-amber-100/80",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100/80",
    rose: "bg-rose-50 text-rose-700 border-rose-100/80",
    sky: "bg-sky-50 text-sky-700 border-sky-100/80",
    slate: "bg-slate-100 text-slate-700 border-slate-200/80",
  };
  return map[color] ?? map.blue;
}

export function getStatusBadgeClass(status: CalendarEventStatus) {
  if (status === "COMPLETED") {
    return "bg-emerald-50 text-emerald-700 border-emerald-100/80";
  }
  if (status === "CANCELLED") {
    return "bg-slate-100 text-slate-600 border-slate-200/80";
  }
  return "bg-sky-50 text-sky-700 border-sky-100/80";
}
