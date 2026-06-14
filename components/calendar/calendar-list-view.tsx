"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CalendarEmptyState } from "@/components/calendar/calendar-empty-state";
import { CALENDAR_CARD_CLASS, CALENDAR_LIST_ROW_CLASS } from "@/components/calendar/calendar-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import {
  getCalendarEventBadgeClass,
  getCalendarEventIcon,
  getCalendarEventTypeLabel,
  isCalendarEventCritical,
} from "@/lib/calendar-ui-utils";
import {
  getCalendarEventHref,
  groupEventsByDay,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarListViewProps = {
  events: NormalizedCalendarEvent[];
  onAddEvent?: () => void;
};

function formatEventTime(event: NormalizedCalendarEvent) {
  if (event.allDay) return "Tüm gün";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

function formatGroupLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function CalendarListView({ events, onAddEvent }: CalendarListViewProps) {
  if (events.length === 0) {
    return (
      <div className={`${CALENDAR_CARD_CLASS} p-5 sm:p-6`}>
        <CalendarEmptyState
          title="Bu dönem için etkinlik bulunmuyor."
          description="Manuel etkinlik ekleyebilir veya filtreleri değiştirebilirsiniz."
          actionLabel={onAddEvent ? "Etkinlik Ekle" : undefined}
          onAction={onAddEvent}
        />
      </div>
    );
  }

  const grouped = groupEventsByDay(events);
  const sortedKeys = [...grouped.keys()].sort();

  return (
    <div className={`${CALENDAR_CARD_CLASS} p-5 sm:p-6`}>
      <div className="space-y-6">
        {sortedKeys.map((dateKey) => {
          const dayEvents = grouped.get(dateKey) ?? [];

          return (
            <section key={dateKey}>
              <h3 className="mb-3 text-sm font-extrabold capitalize text-[#0f1f4d]">
                {formatGroupLabel(dateKey)}
              </h3>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const Icon = getCalendarEventIcon(event);
                  const href = getCalendarEventHref(event);
                  const critical = isCalendarEventCritical(event);

                  return (
                    <article
                      key={event.id}
                      className={[
                        CALENDAR_LIST_ROW_CLASS,
                        critical ? "border-rose-200/80 bg-rose-50/30" : "",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                            critical
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                                getCalendarEventBadgeClass(event),
                              ].join(" ")}
                            >
                              {getCalendarEventTypeLabel(event)}
                            </span>
                            {critical ? (
                              <span className="text-[10px] font-bold text-rose-600">
                                Geciken
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-sm font-extrabold text-[#0f1f4d]">
                            {event.title}
                          </p>
                          {event.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {event.description}
                            </p>
                          ) : null}
                          <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                            {formatEventTime(event)}
                          </p>
                          {event.amount != null ? (
                            <p
                              className={[
                                "mt-1 text-sm font-extrabold",
                                critical ? "text-rose-600" : "text-orange-600",
                              ].join(" ")}
                            >
                              {formatMoney(event.amount)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {href ? (
                        <Link
                          href={href}
                          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-bold text-[#0f1f4d] transition hover:bg-slate-50"
                        >
                          Detaya Git
                          <ChevronRight size={14} />
                        </Link>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
