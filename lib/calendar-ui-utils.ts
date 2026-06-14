import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  FileText,
  Receipt,
  UserRound,
  Wallet,
} from "lucide-react";
import type { CalendarEventSource, CalendarEventType } from "@prisma/client";
import {
  filterEventsByUiState,
  startOfDay,
  toDateKey,
  type CalendarFilterState,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

export type CalendarEventColorKey =
  | "blue"
  | "orange"
  | "amber"
  | "purple"
  | "violet"
  | "emerald"
  | "rose"
  | "sky"
  | "slate";

export type CalendarSourceFilter = "ALL" | "MANUAL" | "SYSTEM";
export type CalendarStatusFilter = "ALL" | "UPCOMING" | "TODAY" | "OVERDUE";
export type CalendarModuleFilter =
  | "ALL"
  | "FINANCE"
  | "EMPLOYEE"
  | "PAYROLL"
  | "INVOICE"
  | "EXPENSE";

export type CalendarExtendedFilterState = CalendarFilterState & {
  searchQuery: string;
  sourceFilter: CalendarSourceFilter;
  statusFilter: CalendarStatusFilter;
  moduleFilter: CalendarModuleFilter;
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_CALENDAR_EXTENDED_FILTERS: CalendarExtendedFilterState = {
  showPayments: true,
  showAppointments: true,
  showReminders: true,
  showSystem: true,
  searchQuery: "",
  sourceFilter: "ALL",
  statusFilter: "ALL",
  moduleFilter: "ALL",
  dateFrom: "",
  dateTo: "",
};

const TYPE_LABELS: Record<CalendarEventType, string> = {
  APPOINTMENT: "Randevu",
  PAYMENT: "Ödeme",
  REMINDER: "Hatırlatma",
};

export function getCalendarEventTypeLabel(
  event: Pick<NormalizedCalendarEvent, "type" | "source" | "relatedType">
): string {
  if (event.relatedType === "EMPLOYEE_LEAVE") return "İzin";
  if (event.relatedType === "EMPLOYEE_PAYMENT") return "Çalışan Ödemesi";
  if (event.relatedType === "PAYROLL_RUN") return "Bordro";
  if (event.relatedType === "EXPENSE") return "Gider";
  if (event.relatedType === "INVOICE" || event.relatedType === "SALE") {
    return "Tahsilat";
  }
  if (event.relatedType === "MEMBERSHIP") return "Üyelik";

  return TYPE_LABELS[event.type];
}

export function getCalendarEventSourceLabel(source: CalendarEventSource): string {
  if (source === "SYSTEM") return "Otomatik";
  return "Manuel";
}

export function isCalendarEventCritical(event: NormalizedCalendarEvent): boolean {
  if (event.status !== "SCHEDULED") return false;

  const today = startOfDay(new Date());
  const eventDate = startOfDay(new Date(event.startAt));
  if (eventDate >= today) return false;

  if (event.type === "PAYMENT") return true;
  if (event.relatedType === "EMPLOYEE_PAYMENT") return true;
  if (event.relatedType === "EXPENSE") return true;
  if (event.relatedType === "INVOICE" || event.relatedType === "SALE") {
    return true;
  }
  if (event.relatedType === "PAYROLL_RUN") return true;

  return false;
}

export function getCalendarEventColorKey(
  event: NormalizedCalendarEvent
): CalendarEventColorKey {
  if (isCalendarEventCritical(event)) return "rose";

  if (event.relatedType === "EMPLOYEE_LEAVE") return "violet";
  if (event.relatedType === "EMPLOYEE_PAYMENT") return "orange";
  if (event.relatedType === "PAYROLL_RUN") return "emerald";
  if (event.relatedType === "EXPENSE") return "rose";
  if (event.relatedType === "INVOICE" || event.relatedType === "SALE") {
    return "emerald";
  }
  if (event.relatedType === "MEMBERSHIP") return "amber";

  if (event.source === "MANUAL") {
    if (event.type === "PAYMENT") return "orange";
    if (event.type === "APPOINTMENT") return "blue";
    return "sky";
  }

  if (event.type === "PAYMENT") return "amber";
  if (event.type === "APPOINTMENT") return "blue";
  return "sky";
}

export function getCalendarEventBadgeClass(event: NormalizedCalendarEvent): string {
  const map: Record<CalendarEventColorKey, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100/80",
    orange: "bg-orange-50 text-orange-700 border-orange-100/80",
    amber: "bg-amber-50 text-amber-800 border-amber-100/80",
    purple: "bg-violet-50 text-violet-700 border-violet-100/80",
    violet: "bg-violet-50 text-violet-700 border-violet-100/80",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100/80",
    rose: "bg-rose-50 text-rose-700 border-rose-100/80",
    sky: "bg-sky-50 text-sky-700 border-sky-100/80",
    slate: "bg-slate-100 text-slate-700 border-slate-200/80",
  };

  return map[getCalendarEventColorKey(event)];
}

export function getCalendarEventAccentClass(event: NormalizedCalendarEvent): string {
  const map: Record<CalendarEventColorKey, string> = {
    blue: "from-blue-500 to-blue-600",
    orange: "from-orange-400 to-orange-600",
    amber: "from-amber-400 to-amber-600",
    purple: "from-violet-500 to-purple-600",
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-emerald-600",
    rose: "from-rose-400 to-rose-600",
    sky: "from-sky-400 to-sky-600",
    slate: "from-slate-400 to-slate-600",
  };

  return map[getCalendarEventColorKey(event)];
}

export function getCalendarEventPillClass(event: NormalizedCalendarEvent): string {
  const map: Record<CalendarEventColorKey, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100/80",
    orange: "bg-orange-50 text-orange-700 ring-orange-100/80",
    amber: "bg-amber-50 text-amber-800 ring-amber-100/80",
    purple: "bg-violet-50 text-violet-700 ring-violet-100/80",
    violet: "bg-violet-50 text-violet-700 ring-violet-100/80",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100/80",
    rose: "bg-rose-50 text-rose-700 ring-rose-100/80",
    sky: "bg-sky-50 text-sky-700 ring-sky-100/80",
    slate: "bg-slate-100 text-slate-700 ring-slate-200/80",
  };

  return map[getCalendarEventColorKey(event)];
}

export function getCalendarEventDotClass(event: NormalizedCalendarEvent): string {
  const map: Record<CalendarEventColorKey, string> = {
    blue: "bg-blue-500",
    orange: "bg-orange-500",
    amber: "bg-amber-500",
    purple: "bg-violet-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
    slate: "bg-slate-500",
  };

  return map[getCalendarEventColorKey(event)];
}

export function getCalendarEventIcon(event: NormalizedCalendarEvent): LucideIcon {
  if (event.relatedType === "EMPLOYEE_LEAVE") return UserRound;
  if (event.relatedType === "EMPLOYEE_PAYMENT") return Wallet;
  if (event.relatedType === "PAYROLL_RUN") return Receipt;
  if (event.relatedType === "EXPENSE") return FileText;
  if (event.relatedType === "INVOICE" || event.relatedType === "SALE") {
    return Wallet;
  }
  if (event.relatedType === "MEMBERSHIP") return CalendarClock;
  if (isCalendarEventCritical(event)) return AlertCircle;
  if (event.type === "PAYMENT") return Wallet;
  if (event.type === "APPOINTMENT") return Calendar;
  return Bell;
}

export function canEditCalendarEvent(event: NormalizedCalendarEvent): boolean {
  return !event.readOnly;
}

export function getVisibleEventChips<T>(events: T[], maxVisible = 3) {
  return {
    visible: events.slice(0, maxVisible),
    hiddenCount: Math.max(0, events.length - maxVisible),
  };
}

function getEventModule(
  event: NormalizedCalendarEvent
): CalendarModuleFilter | "OTHER" {
  if (event.relatedType === "INVOICE" || event.relatedType === "SALE") {
    return "INVOICE";
  }
  if (event.relatedType === "EXPENSE") return "EXPENSE";
  if (
    event.relatedType === "EMPLOYEE_LEAVE" ||
    event.relatedType === "EMPLOYEE_PAYMENT"
  ) {
    return "EMPLOYEE";
  }
  if (event.relatedType === "PAYROLL_RUN") return "PAYROLL";
  if (event.relatedType === "MEMBERSHIP") return "FINANCE";

  if (event.type === "PAYMENT") return "FINANCE";
  return "OTHER";
}

export function filterCalendarEvents(
  events: NormalizedCalendarEvent[],
  filters: CalendarExtendedFilterState
) {
  const base = filterEventsByUiState(events, filters);
  const todayKey = toDateKey(new Date());
  const today = startOfDay(new Date());
  const query = filters.searchQuery.trim().toLowerCase();

  return base.filter((event) => {
    if (filters.sourceFilter === "MANUAL" && event.source !== "MANUAL") {
      return false;
    }
    if (filters.sourceFilter === "SYSTEM" && event.source !== "SYSTEM") {
      return false;
    }

    if (filters.statusFilter === "TODAY") {
      if (toDateKey(new Date(event.startAt)) !== todayKey) return false;
    }
    if (filters.statusFilter === "UPCOMING") {
      if (startOfDay(new Date(event.startAt)) < today) return false;
    }
    if (filters.statusFilter === "OVERDUE") {
      if (!isCalendarEventCritical(event)) return false;
    }

    if (filters.moduleFilter !== "ALL") {
      const module = getEventModule(event);
      if (filters.moduleFilter === "FINANCE") {
        if (module !== "FINANCE" && module !== "INVOICE") return false;
      } else if (module !== filters.moduleFilter) {
        return false;
      }
    }

    if (filters.dateFrom) {
      const from = startOfDay(new Date(filters.dateFrom));
      if (startOfDay(new Date(event.startAt)) < from) return false;
    }

    if (filters.dateTo) {
      const to = startOfDay(new Date(filters.dateTo));
      if (startOfDay(new Date(event.startAt)) > to) return false;
    }

    if (query) {
      const haystack = [event.title, event.description ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function computeCalendarStats(events: NormalizedCalendarEvent[]) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const dayStart = startOfDay(now);
  const weekStart = new Date(now);
  const weekOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const todayEvents = events.filter(
    (event) => toDateKey(new Date(event.startAt)) === todayKey
  );

  const weekEvents = events.filter((event) => {
    const time = new Date(event.startAt).getTime();
    return time >= weekStart.getTime() && time <= weekEnd.getTime();
  });

  const upcomingPayments = events.filter(
    (event) =>
      (event.type === "PAYMENT" ||
        event.relatedType === "EMPLOYEE_PAYMENT" ||
        event.relatedType === "PAYROLL_RUN") &&
      new Date(event.startAt) >= dayStart &&
      !isCalendarEventCritical(event)
  );

  const staffEvents = events.filter(
    (event) =>
      event.relatedType === "EMPLOYEE_LEAVE" ||
      event.relatedType === "EMPLOYEE_PAYMENT"
  );

  const criticalEvents = events.filter(isCalendarEventCritical);

  return {
    todayCount: todayEvents.length,
    weekCount: weekEvents.length,
    upcomingPaymentCount: upcomingPayments.length,
    staffCount: staffEvents.length,
    criticalCount: criticalEvents.length,
  };
}
