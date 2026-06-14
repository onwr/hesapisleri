import { z } from "zod";
import type {
  CalendarEventSource,
  CalendarEventStatus,
  CalendarEventType,
} from "@prisma/client";

export type NormalizedCalendarEvent = {
  id: string;
  companyId: string;
  userId?: string | null;
  type: CalendarEventType;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  amount?: number | null;
  currency?: string | null;
  color?: string | null;
  status: CalendarEventStatus;
  source: CalendarEventSource;
  relatedType?: string | null;
  relatedId?: string | null;
  actionUrl?: string | null;
  readOnly: boolean;
};

export type CalendarDayCell = {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export type CalendarFilterState = {
  showPayments: boolean;
  showAppointments: boolean;
  showReminders: boolean;
  showSystem: boolean;
};

export const DEFAULT_CALENDAR_FILTERS: CalendarFilterState = {
  showPayments: true,
  showAppointments: true,
  showReminders: true,
  showSystem: true,
};

export const CALENDAR_TYPE_LABELS: Record<CalendarEventType, string> = {
  APPOINTMENT: "Randevu",
  PAYMENT: "Ödeme",
  REMINDER: "Hatırlatıcı",
};

export const CALENDAR_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  SCHEDULED: "Planlandı",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const SYSTEM_EVENT_PREFIX = "system:";

export function isSystemEventId(id: string) {
  return id.startsWith(SYSTEM_EVENT_PREFIX);
}

export function parseSystemEventId(id: string) {
  if (!isSystemEventId(id)) return null;
  const [, entityType, entityId] = id.split(":");
  if (!entityType || !entityId) return null;
  return { entityType, entityId };
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function parseCalendarDateRange(input: {
  from?: string | null;
  to?: string | null;
}) {
  const now = new Date();
  const defaultFrom = startOfDay(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const defaultTo = endOfDay(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  );

  const from = input.from ? new Date(input.from) : defaultFrom;
  const to = input.to ? new Date(input.to) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false as const, message: "Geçersiz tarih aralığı." };
  }

  if (from > to) {
    return { ok: false as const, message: "Başlangıç tarihi bitişten büyük olamaz." };
  }

  return { ok: true as const, from, to };
}

export function parseCalendarTypesParam(raw?: string | null) {
  if (!raw?.trim()) {
    return ["APPOINTMENT", "PAYMENT", "REMINDER"] as CalendarEventType[];
  }

  const allowed = new Set<CalendarEventType>([
    "APPOINTMENT",
    "PAYMENT",
    "REMINDER",
  ]);

  const parsed = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is CalendarEventType =>
      allowed.has(item as CalendarEventType)
    );

  return parsed.length > 0
    ? parsed
    : (["APPOINTMENT", "PAYMENT", "REMINDER"] as CalendarEventType[]);
}

export function parseIncludeSystemParam(raw?: string | null) {
  if (raw === undefined || raw === null || raw === "") return true;
  return raw !== "false" && raw !== "0";
}

export function normalizeCalendarEvent(
  event: {
    id: string;
    companyId: string;
    userId?: string | null;
    type: CalendarEventType;
    title: string;
    description?: string | null;
    startAt: Date | string;
    endAt?: Date | string | null;
    allDay: boolean;
    amount?: unknown;
    currency?: string | null;
    color?: string | null;
    status: CalendarEventStatus;
    source: CalendarEventSource;
    relatedType?: string | null;
    relatedId?: string | null;
    actionUrl?: string | null;
  },
  readOnly?: boolean
): NormalizedCalendarEvent {
  const amount =
    event.amount === null || event.amount === undefined
      ? null
      : Number(event.amount);

  return {
    id: event.id,
    companyId: event.companyId,
    userId: event.userId ?? null,
    type: event.type,
    title: event.title,
    description: event.description ?? null,
    startAt: new Date(event.startAt).toISOString(),
    endAt: event.endAt ? new Date(event.endAt).toISOString() : null,
    allDay: event.allDay,
    amount: Number.isFinite(amount) ? amount : null,
    currency: event.currency ?? null,
    color: event.color ?? null,
    status: event.status,
    source: event.source,
    relatedType: event.relatedType ?? null,
    relatedId: event.relatedId ?? null,
    actionUrl: event.actionUrl ?? null,
    readOnly:
      readOnly ?? (event.source === "SYSTEM" || isSystemEventId(event.id)),
  };
}

export function groupEventsByDay(events: NormalizedCalendarEvent[]) {
  const groups = new Map<string, NormalizedCalendarEvent[]>();

  for (const event of events) {
    const key = toDateKey(new Date(event.startAt));
    const existing = groups.get(key) ?? [];
    existing.push(event);
    groups.set(key, existing);
  }

  for (const [key, list] of groups.entries()) {
    list.sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    groups.set(key, list);
  }

  return groups;
}

export function buildMonthGrid(year: number, month: number): CalendarDayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = toDateKey(new Date());
  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    const dateKey = toDateKey(date);
    cells.push({
      date,
      dateKey,
      isCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
    });
  }

  return cells;
}

export function buildWeekDays(anchor: Date): CalendarDayCell[] {
  const day = anchor.getDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - mondayOffset);
  const todayKey = toDateKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      date,
      dateKey,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
    };
  });
}

export function getCalendarEventColor(
  type: CalendarEventType,
  source: CalendarEventSource,
  customColor?: string | null
) {
  if (customColor) return customColor;
  if (source === "SYSTEM") return "amber";
  if (type === "PAYMENT") return "orange";
  if (type === "APPOINTMENT") return "blue";
  return "purple";
}

export function getCalendarEventHref(event: NormalizedCalendarEvent) {
  if (event.actionUrl) {
    return event.actionUrl;
  }

  if (!event.readOnly || !event.relatedType || !event.relatedId) return null;

  if (event.relatedType === "INVOICE") {
    return `/invoices/${event.relatedId}`;
  }
  if (event.relatedType === "SALE") {
    return `/sales/${event.relatedId}`;
  }
  if (event.relatedType === "EXPENSE") {
    return `/expenses/${event.relatedId}`;
  }
  if (event.relatedType === "MEMBERSHIP") {
    return "/settings";
  }

  return null;
}

export const DEFAULT_COLLECTION_DUE_DAYS = 30;

export function resolveCollectionDueDate(input: {
  issueDate: Date;
  dueDate?: Date | null;
  defaultDueDays?: number;
}) {
  if (input.dueDate) {
    return startOfDay(input.dueDate);
  }

  const fallback = new Date(input.issueDate);
  fallback.setDate(
    fallback.getDate() + (input.defaultDueDays ?? DEFAULT_COLLECTION_DUE_DAYS)
  );
  return startOfDay(fallback);
}

export function isDateInRange(date: Date, from: Date, to: Date) {
  const time = startOfDay(date).getTime();
  return (
    time >= startOfDay(from).getTime() && time <= endOfDay(to).getTime()
  );
}

export function rangesOverlap(
  rangeStart: Date,
  rangeEnd: Date,
  from: Date,
  to: Date
) {
  return (
    startOfDay(rangeStart).getTime() <= endOfDay(to).getTime() &&
    endOfDay(rangeEnd).getTime() >= startOfDay(from).getTime()
  );
}

export const createCalendarEventSchema = z.object({
  type: z.enum(["APPOINTMENT", "PAYMENT", "REMINDER"]),
  title: z.string().trim().min(1, "Başlık zorunludur."),
  description: z.string().optional(),
  startAt: z.string().min(1, "Başlangıç tarihi zorunludur."),
  endAt: z.string().optional(),
  allDay: z.boolean().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  color: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial();

export function validateCalendarEventInput(input: {
  type: CalendarEventType;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  amount?: number;
  currency?: string;
  color?: string;
  status?: CalendarEventStatus;
}) {
  const parsed = createCalendarEventSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      message:
        parsed.error.flatten().fieldErrors.title?.[0] ??
        parsed.error.flatten().fieldErrors.startAt?.[0] ??
        "Takvim kaydı bilgilerini kontrol edin.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false as const, message: "Geçersiz başlangıç tarihi." };
  }

  if (parsed.data.endAt) {
    const endAt = new Date(parsed.data.endAt);
    if (Number.isNaN(endAt.getTime())) {
      return { ok: false as const, message: "Geçersiz bitiş tarihi." };
    }
    if (endAt < startAt) {
      return {
        ok: false as const,
        message: "Bitiş tarihi başlangıçtan önce olamaz.",
      };
    }
  }

  return { ok: true as const, data: parsed.data };
}

export function filterEventsByUiState(
  events: NormalizedCalendarEvent[],
  filters: CalendarFilterState
) {
  return events.filter((event) => {
    if (event.source === "SYSTEM") return filters.showSystem;
    if (event.type === "PAYMENT") return filters.showPayments;
    if (event.type === "APPOINTMENT") return filters.showAppointments;
    if (event.type === "REMINDER") return filters.showReminders;
    return true;
  });
}

export function countEventsForDay(
  events: NormalizedCalendarEvent[],
  dateKey: string
) {
  return events.filter((event) => toDateKey(new Date(event.startAt)) === dateKey)
    .length;
}
