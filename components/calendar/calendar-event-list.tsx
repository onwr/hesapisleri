"use client";

import Link from "next/link";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { CalendarEmptyState } from "@/components/calendar/calendar-empty-state";
import { getStatusBadgeClass } from "@/components/calendar/calendar-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import {
  canEditCalendarEvent,
  getCalendarEventAccentClass,
  getCalendarEventBadgeClass,
  getCalendarEventIcon,
  getCalendarEventSourceLabel,
  getCalendarEventTypeLabel,
  isCalendarEventCritical,
} from "@/lib/calendar-ui-utils";
import {
  CALENDAR_STATUS_LABELS,
  getCalendarEventHref,
  toDateKey,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarEventListProps = {
  events: NormalizedCalendarEvent[];
  selectedDateKey?: string | null;
  onEdit?: (event: NormalizedCalendarEvent) => void;
  onDelete?: (event: NormalizedCalendarEvent) => void;
  onAddEvent?: () => void;
  emptyMessage?: string;
  emptyDescription?: string;
  compact?: boolean;
};

function formatEventTime(event: NormalizedCalendarEvent) {
  if (event.allDay) return "Tüm gün";

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(event.startAt));
}

export function CalendarEventList({
  events,
  selectedDateKey,
  onEdit,
  onDelete,
  onAddEvent,
  emptyMessage = "Bu dönem için etkinlik bulunmuyor.",
  emptyDescription = "Manuel etkinlik ekleyebilir veya filtreleri değiştirebilirsiniz.",
  compact = false,
}: CalendarEventListProps) {
  const visibleEvents = selectedDateKey
    ? events.filter(
        (event) => toDateKey(new Date(event.startAt)) === selectedDateKey
      )
    : events;

  if (visibleEvents.length === 0) {
    return (
      <CalendarEmptyState
        title={emptyMessage}
        description={emptyDescription}
        compact={compact}
        actionLabel={onAddEvent ? "Etkinlik Ekle" : undefined}
        onAction={onAddEvent}
      />
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {visibleEvents.map((event) => {
        const Icon = getCalendarEventIcon(event);
        const href = getCalendarEventHref(event);
        const critical = isCalendarEventCritical(event);
        const editable = canEditCalendarEvent(event);

        return (
          <article
            key={event.id}
            className={[
              "group relative overflow-hidden rounded-2xl border bg-white transition hover:shadow-md hover:shadow-slate-100/80",
              critical
                ? "border-rose-200/80 bg-rose-50/20"
                : event.readOnly
                  ? "border-slate-200/80 bg-slate-50/30"
                  : "border-slate-200/80 shadow-sm shadow-slate-100/60",
              compact ? "p-3" : "p-4",
            ].join(" ")}
          >
            <div
              className={[
                "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                getCalendarEventAccentClass(event),
              ].join(" ")}
            />

            <div className="flex items-start justify-between gap-3 pl-2">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    critical
                      ? "bg-rose-50 text-rose-600"
                      : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  <Icon size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                        getCalendarEventBadgeClass(event),
                      ].join(" ")}
                    >
                      {getCalendarEventTypeLabel(event)}
                    </span>

                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        getStatusBadgeClass(event.status),
                      ].join(" ")}
                    >
                      {CALENDAR_STATUS_LABELS[event.status]}
                    </span>

                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {getCalendarEventSourceLabel(event.source)}
                    </span>

                    <span className="text-[11px] font-semibold text-slate-400">
                      {formatEventTime(event)}
                    </span>
                  </div>

                  <p
                    className={[
                      "mt-2 font-extrabold text-[#0f1f4d]",
                      compact ? "text-xs" : "text-sm",
                    ].join(" ")}
                  >
                    {event.title}
                  </p>

                  {event.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {event.description}
                    </p>
                  ) : null}

                  {event.readOnly ? (
                    <p className="mt-2 text-[11px] font-medium text-slate-500">
                      Bu kayıt ilgili modülden otomatik oluşturuldu.
                    </p>
                  ) : null}

                  {event.amount != null ? (
                    <p
                      className={[
                        "mt-2 text-sm font-extrabold",
                        critical ? "text-rose-600" : "text-orange-600",
                      ].join(" ")}
                    >
                      {formatMoney(event.amount)}
                    </p>
                  ) : null}

                  {href ? (
                    <Link
                      href={href}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-700"
                    >
                      {event.readOnly ? "Kaynağa Git" : "Detaya Git"}
                      <ChevronRight size={14} />
                    </Link>
                  ) : null}
                </div>
              </div>

              {editable ? (
                <div className="flex shrink-0 items-center gap-1">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={() => onEdit(event)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      title="Düzenle"
                    >
                      <Pencil size={15} />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(event)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                      title="Sil"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
