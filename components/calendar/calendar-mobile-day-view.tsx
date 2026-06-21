"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";
import { buildMonthGrid, toDateKey, type NormalizedCalendarEvent } from "@/lib/calendar-utils";

type CalendarMobileDayViewProps = {
  anchorDate: Date;
  selectedDateKey: string;
  events: NormalizedCalendarEvent[];
  onSelectDate: (dateKey: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onEventClick: (event: NormalizedCalendarEvent) => void;
  onAddEvent: () => void;
};

export function CalendarMobileDayView({
  anchorDate,
  selectedDateKey,
  events,
  onSelectDate,
  onPrevious,
  onNext,
  onEventClick,
  onAddEvent,
}: CalendarMobileDayViewProps) {
  const cells = useMemo(
    () => buildMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth()),
    [anchorDate]
  );

  const visibleCells = useMemo(() => {
    const selectedIndex = cells.findIndex((cell) => cell.dateKey === selectedDateKey);
    if (selectedIndex < 0) return cells.slice(0, 7);

    const start = Math.max(0, selectedIndex - 3);
    return cells.slice(start, start + 7);
  }, [cells, selectedDateKey]);

  const selectedDayEvents = useMemo(
    () =>
      events.filter(
        (event) => toDateKey(new Date(event.startAt)) === selectedDateKey
      ),
    [events, selectedDateKey]
  );

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  return (
    <div className="space-y-3 xl:hidden">
      <div className={`${CALENDAR_CARD_CLASS} p-3`}>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrevious}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200"
            aria-label="Önceki günler"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-sm font-black capitalize text-[#0f1f4d]">
            {new Intl.DateTimeFormat("tr-TR", {
              month: "long",
              year: "numeric",
            }).format(anchorDate)}
          </p>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200"
            aria-label="Sonraki günler"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {visibleCells.map((cell) => {
            const isSelected = cell.dateKey === selectedDateKey;
            const dayEvents = events.filter(
              (event) => toDateKey(new Date(event.startAt)) === cell.dateKey
            );

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectDate(cell.dateKey)}
                className={[
                  "flex flex-col items-center rounded-xl px-1 py-2 transition",
                  isSelected
                    ? "bg-[#0f1f4d] text-white"
                    : cell.isToday
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50",
                  !cell.isCurrentMonth && !isSelected ? "opacity-50" : "",
                ].join(" ")}
              >
                <span className="text-[10px] font-bold uppercase">
                  {new Intl.DateTimeFormat("tr-TR", { weekday: "short" })
                    .format(cell.date)
                    .slice(0, 3)}
                </span>
                <span className="mt-1 text-sm font-black">{cell.date.getDate()}</span>
                {dayEvents.length > 0 ? (
                  <span
                    className={[
                      "mt-1 h-1.5 w-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-blue-500",
                    ].join(" ")}
                  />
                ) : (
                  <span className="mt-1 h-1.5 w-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${CALENDAR_CARD_CLASS} p-4`}>
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Seçili Gün
          </p>
          <h3 className="mt-1 text-base font-extrabold capitalize text-[#0f1f4d]">
            {new Intl.DateTimeFormat("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(selectedDate)}
          </h3>
        </div>

        <CalendarEventList
          events={selectedDayEvents}
          onEdit={onEventClick}
          onAddEvent={onAddEvent}
          emptyMessage="Bu gün için etkinlik bulunmuyor."
          emptyDescription="Yeni etkinlik ekleyebilirsiniz."
          compact
        />
      </div>
    </div>
  );
}
