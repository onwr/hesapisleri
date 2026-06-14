"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronRight as RowChevron,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { CalendarEmptyState } from "@/components/calendar/calendar-empty-state";
import { CalendarView, toDateKey } from "@/components/calendar/calendar-view";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import {
  DEFAULT_CALENDAR_EXTENDED_FILTERS,
  filterCalendarEvents,
  getCalendarEventBadgeClass,
  getCalendarEventIcon,
  getCalendarEventSourceLabel,
  getCalendarEventTypeLabel,
  isCalendarEventCritical,
} from "@/lib/calendar-ui-utils";
import {
  endOfDay,
  getCalendarEventHref,
  startOfDay,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarQuickModalProps = {
  onClose: () => void;
};

function formatEventTime(event: NormalizedCalendarEvent) {
  if (event.allDay) return "Tüm gün";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

function QuickEventRow({ event }: { event: NormalizedCalendarEvent }) {
  const Icon = getCalendarEventIcon(event);
  const href = getCalendarEventHref(event);
  const critical = isCalendarEventCritical(event);

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition",
        critical
          ? "border-rose-200/80 bg-rose-50/40"
          : "border-slate-200/70 bg-white hover:border-slate-300 hover:shadow-sm",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          critical ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600",
        ].join(" ")}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={[
              "inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide",
              getCalendarEventBadgeClass(event),
            ].join(" ")}
          >
            {getCalendarEventTypeLabel(event)}
          </span>
          <span className="text-[9px] font-bold text-slate-500">
            {getCalendarEventSourceLabel(event.source)}
          </span>
          {critical ? (
            <span className="text-[9px] font-bold text-rose-600">Geciken</span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs font-extrabold text-[#0f1f4d]">
          {event.title}
        </p>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500">
          {formatEventTime(event)}
        </p>
        {event.amount != null ? (
          <p className="mt-1 text-[11px] font-extrabold text-orange-600">
            {formatMoney(event.amount)}
          </p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
        >
          Detay
          <RowChevron size={12} />
        </Link>
      ) : null}
    </div>
  );
}

export function CalendarQuickModal({ onClose }: CalendarQuickModalProps) {
  const today = new Date();
  const [anchorDate, setAnchorDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [events, setEvents] = useState<NormalizedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const from = startOfDay(
      new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    );
    const to = endOfDay(
      new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
    );
    return { from, to };
  }, [anchorDate]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        types: "APPOINTMENT,PAYMENT,REMINDER",
        includeSystem: "true",
      });

      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setEvents(
          filterCalendarEvents(json.events ?? [], DEFAULT_CALENDAR_EXTENDED_FILTERS)
        );
      }
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const todayKey = toDateKey(today);
  const todayEvents = useMemo(
    () =>
      events.filter(
        (event) => toDateKey(new Date(event.startAt)) === todayKey
      ),
    [events, todayKey]
  );

  const upcomingEvents = useMemo(() => {
    const now = startOfDay(new Date());
    return events
      .filter((event) => new Date(event.startAt) >= now)
      .slice(0, 5);
  }, [events]);

  const criticalCount = useMemo(
    () => events.filter(isCalendarEventCritical).length,
    [events]
  );

  const monthLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(anchorDate);

  return (
    <div className="flex max-h-[min(88vh,720px)] flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200/70 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0f1f4d]">Takvim</h2>
              <p className="mt-1 text-xs text-slate-500">
                Bugün ve yaklaşan etkinlikler
              </p>
              {criticalCount > 0 ? (
                <p className="mt-2 text-[11px] font-bold text-rose-600">
                  {criticalCount} geciken/kritik kayıt var
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Kapat"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
          <button
            type="button"
            onClick={() =>
              setAnchorDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-[#0f1f4d]"
            aria-label="Önceki ay"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-extrabold capitalize text-[#0f1f4d]">
            {monthLabel}
          </p>
          <button
            type="button"
            onClick={() =>
              setAnchorDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-[#0f1f4d]"
            aria-label="Sonraki ay"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            <CalendarView
              viewMode="month"
              anchorDate={anchorDate}
              events={events}
              selectedDateKey={selectedDateKey}
              onSelectDate={setSelectedDateKey}
              compact
              mini
              embedded
            />

            <div className={`${CALENDAR_CARD_CLASS} mt-5 p-4`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold text-[#0f1f4d]">Bugün</h3>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-700">
                  {todayEvents.length}
                </span>
              </div>
              {todayEvents.length === 0 ? (
                <CalendarEmptyState
                  title="Bugün etkinlik yok"
                  description="Planlanmış bir kayıt bulunmuyor."
                  compact
                />
              ) : (
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {todayEvents.slice(0, 4).map((event) => (
                    <QuickEventRow key={`today-${event.id}`} event={event} />
                  ))}
                </div>
              )}
            </div>

            <div className={`${CALENDAR_CARD_CLASS} mt-4 p-4`}>
              <h3 className="mb-3 text-xs font-extrabold text-[#0f1f4d]">
                Yaklaşan 5 etkinlik
              </h3>
              {upcomingEvents.length === 0 ? (
                <CalendarEmptyState
                  title="Yaklaşan etkinlik yok"
                  compact
                />
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {upcomingEvents.map((event) => (
                    <QuickEventRow key={`upcoming-${event.id}`} event={event} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-slate-200/80 bg-slate-50/50 px-5 py-4">
        <Link
          href="/calendar"
          onClick={onClose}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-xs font-bold text-[#0f1f4d] transition hover:bg-slate-50"
        >
          Tam Takvimi Aç
        </Link>
        <Link
          href="/calendar"
          onClick={onClose}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#0f1f4d] text-xs font-bold text-white transition hover:bg-[#162a5c]"
        >
          <Plus size={14} />
          Etkinlik Ekle
        </Link>
      </div>
    </div>
  );
}

type CalendarModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CalendarModal({ open, onClose }: CalendarModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Takvim"
    >
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_28px_70px_rgba(15,31,77,0.18)]">
        <CalendarQuickModal onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}

export function CalendarTopbarButton() {
  const [open, setOpen] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);

  const loadTodayCount = useCallback(async () => {
    setLoadingCount(true);

    try {
      const now = new Date();
      const from = startOfDay(now);
      const to = endOfDay(now);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        types: "APPOINTMENT,PAYMENT,REMINDER",
        includeSystem: "true",
      });

      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.success) {
        const filtered = filterCalendarEvents(
          json.events ?? [],
          DEFAULT_CALENDAR_EXTENDED_FILTERS
        );
        const todayKey = toDateKey(now);
        setTodayCount(
          filtered.filter(
            (event: NormalizedCalendarEvent) =>
              toDateKey(new Date(event.startAt)) === todayKey
          ).length
        );
      }
    } finally {
      setLoadingCount(false);
    }
  }, []);

  useEffect(() => {
    void loadTodayCount();
  }, [loadTodayCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#0f1f4d] shadow-sm shadow-slate-100/70 transition hover:border-blue-100 hover:bg-blue-50/60 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
        aria-label="Takvimi aç"
      >
        <CalendarDays size={18} />
        {!loadingCount && todayCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f1f4d] px-1 text-[10px] font-black text-white ring-2 ring-white">
            {todayCount > 9 ? "9+" : todayCount}
          </span>
        ) : null}
      </button>

      <CalendarModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
