"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";
import {
  getCalendarEventBadgeClass,
  getCalendarEventTypeLabel,
  isCalendarEventCritical,
} from "@/lib/calendar-ui-utils";
import {
  getCalendarEventHref,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarSidePanelProps = {
  todayEvents: NormalizedCalendarEvent[];
  upcomingEvents: NormalizedCalendarEvent[];
  overdueEvents: NormalizedCalendarEvent[];
  onEventClick: (event: NormalizedCalendarEvent) => void;
  onCreate: () => void;
  onComplete?: (event: NormalizedCalendarEvent) => void;
};

function formatEventTime(event: NormalizedCalendarEvent) {
  if (event.allDay) return "Tüm gün";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

function formatUpcomingDate(event: NormalizedCalendarEvent) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

function formatRemaining(event: NormalizedCalendarEvent) {
  const diffMs = new Date(event.startAt).getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 24) return `${Math.max(diffHours, 1)} saat içinde`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} gün içinde`;
}

function EventRow({
  event,
  onClick,
  trailing,
}: {
  event: NormalizedCalendarEvent;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  const critical = isCalendarEventCritical(event);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50",
        critical ? "border-rose-200 bg-rose-50/40" : "border-slate-200/80 bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">
              {formatEventTime(event)}
            </span>
            <span
              className={[
                "rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase",
                getCalendarEventBadgeClass(event),
              ].join(" ")}
            >
              {getCalendarEventTypeLabel(event)}
            </span>
          </div>
          <p className="mt-1 truncate text-[12px] font-black text-[#0f1f4d]">
            {event.title}
          </p>
        </div>
        {trailing}
      </div>
    </button>
  );
}

export function CalendarSidePanel({
  todayEvents,
  upcomingEvents,
  overdueEvents,
  onEventClick,
  onCreate,
  onComplete,
}: CalendarSidePanelProps) {
  return (
    <aside className="space-y-3 xl:sticky xl:top-24 xl:self-start">
      <div className={`${CALENDAR_CARD_CLASS} p-4`}>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f4d] text-[12px] font-black text-white transition hover:bg-[#162a5c]"
        >
          <Plus size={14} />
          Yeni Etkinlik
        </button>
      </div>

      <PanelSection title="Bugünün Programı" count={todayEvents.length}>
        {todayEvents.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-500">
            Bugün için etkinlik yok.
          </p>
        ) : (
          <div className="space-y-2">
            {todayEvents.slice(0, 6).map((event) => {
              const href = getCalendarEventHref(event);
              return (
                <EventRow
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                  trailing={
                    href ? (
                      <Link
                        href={href}
                        onClick={(clickEvent) => clickEvent.stopPropagation()}
                        className="shrink-0 text-slate-400 hover:text-blue-600"
                        aria-label="İlgili kayda git"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Yaklaşan Etkinlikler" count={upcomingEvents.length}>
        {upcomingEvents.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-500">
            Yaklaşan etkinlik bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.slice(0, 5).map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventClick(event)}
                className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
              >
                <p className="text-[10px] font-bold text-slate-500">
                  {formatUpcomingDate(event)} · {formatRemaining(event)}
                </p>
                <p className="mt-1 truncate text-[12px] font-black text-[#0f1f4d]">
                  {event.title}
                </p>
              </button>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Gecikmiş İşlemler" count={overdueEvents.length} tone="rose">
        {overdueEvents.length === 0 ? (
          <p className="text-[11px] font-medium text-slate-500">
            Gecikmiş işlem yok.
          </p>
        ) : (
          <div className="space-y-2">
            {overdueEvents.slice(0, 5).map((event) => {
              const href = getCalendarEventHref(event);
              return (
                <div key={event.id} className="space-y-2">
                  <EventRow event={event} onClick={() => onEventClick(event)} />
                  <div className="flex gap-2 px-1">
                    {href ? (
                      <Link
                        href={href}
                        className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 text-[10px] font-black text-[#0f1f4d]"
                      >
                        Kayda Git
                      </Link>
                    ) : null}
                    {!event.readOnly && onComplete ? (
                      <button
                        type="button"
                        onClick={() => onComplete(event)}
                        className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-emerald-600 text-[10px] font-black text-white"
                      >
                        Tamamlandı
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </aside>
  );
}

function PanelSection({
  title,
  count,
  tone = "slate",
  children,
}: {
  title: string;
  count: number;
  tone?: "slate" | "rose";
  children: ReactNode;
}) {
  return (
    <div className={`${CALENDAR_CARD_CLASS} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-black text-[#0f1f4d]">{title}</h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-black",
            tone === "rose" && count > 0
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}
