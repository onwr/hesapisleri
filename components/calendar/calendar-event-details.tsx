"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";
import {
  getCalendarEventBadgeClass,
  getCalendarEventIcon,
  getCalendarEventTypeLabel,
} from "@/lib/calendar-ui-utils";
import {
  getCalendarEventHref,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarEventDetailsProps = {
  event: NormalizedCalendarEvent | null;
  onClose: () => void;
  onEdit?: (event: NormalizedCalendarEvent) => void;
  onDelete?: (event: NormalizedCalendarEvent) => void;
  onComplete?: (event: NormalizedCalendarEvent) => void;
};

function formatWhen(event: NormalizedCalendarEvent) {
  const start = new Date(event.startAt);
  if (event.allDay) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);
}

export function CalendarEventDetails({
  event,
  onClose,
  onEdit,
  onDelete,
  onComplete,
}: CalendarEventDetailsProps) {
  if (!event) return null;

  const Icon = getCalendarEventIcon(event);
  const href = getCalendarEventHref(event);
  const readOnly = event.readOnly || event.source === "SYSTEM";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <span
                className={[
                  "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase",
                  getCalendarEventBadgeClass(event),
                ].join(" ")}
              >
                {getCalendarEventTypeLabel(event)}
              </span>
              <h3 className="mt-1.5 text-lg font-extrabold text-[#0f1f4d]">{event.title}</h3>
              <p className="mt-1 text-[12px] text-slate-500">{formatWhen(event)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {readOnly ? (
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
            Bu etkinlik sistem tarafından oluşturuldu. Yalnızca görüntüleyebilirsiniz.
          </p>
        ) : null}

        {event.description ? (
          <p className="text-[13px] text-slate-600">{event.description}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-black"
            >
              İlgili Kayda Git
            </Link>
          ) : null}
          {!readOnly && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(event)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-black"
            >
              Düzenle
            </button>
          ) : null}
          {!readOnly && event.status !== "COMPLETED" && onComplete ? (
            <button
              type="button"
              onClick={() => onComplete(event)}
              className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-[12px] font-black text-white"
            >
              Tamamlandı İşaretle
            </button>
          ) : null}
          {!readOnly && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(event)}
              className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[12px] font-black text-rose-700"
            >
              Sil
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
