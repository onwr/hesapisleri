"use client";

import {
  buildMonthGrid,
  buildWeekDays,
  countEventsForDay,
  groupEventsByDay,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";
import {
  getCalendarEventDotClass,
  getCalendarEventPillClass,
  getVisibleEventChips,
} from "@/lib/calendar-ui-utils";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";

type CalendarViewProps = {
  viewMode: "month" | "week";
  anchorDate: Date;
  events: NormalizedCalendarEvent[];
  selectedDateKey: string;
  onSelectDate: (dateKey: string) => void;
  onEventClick?: (event: NormalizedCalendarEvent) => void;
  compact?: boolean;
  mini?: boolean;
  embedded?: boolean;
};

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function CalendarView({
  viewMode,
  anchorDate,
  events,
  selectedDateKey,
  onSelectDate,
  onEventClick,
  compact = false,
  mini = false,
  embedded = false,
}: CalendarViewProps) {
  const grouped = groupEventsByDay(events);
  const cells =
    viewMode === "month"
      ? buildMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth())
      : buildWeekDays(anchorDate);

  const maxVisible = mini ? 0 : compact ? 2 : viewMode === "week" ? 4 : 3;

  const wrapperClass = embedded
    ? ""
    : `${CALENDAR_CARD_CLASS} ${mini ? "p-2.5" : "p-4 sm:p-5"}`;

  return (
    <div className={wrapperClass}>
      <div
        className={[
          "mb-2 grid grid-cols-7",
          mini ? "gap-0.5" : "gap-1",
        ].join(" ")}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={[
              "text-center font-black uppercase tracking-wide text-slate-400",
              mini ? "py-0.5 text-[10px]" : "py-1.5 text-[11px]",
            ].join(" ")}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className={[
          "grid grid-cols-7",
          mini ? "gap-0.5" : viewMode === "week" ? "gap-1.5" : "gap-1",
          viewMode === "week" && !mini ? "overflow-x-auto" : "",
        ].join(" ")}
      >
        {cells.map((cell) => {
          const dayEvents = grouped.get(cell.dateKey) ?? [];
          const eventCount = countEventsForDay(events, cell.dateKey);
          const isSelected = cell.dateKey === selectedDateKey;
          const hasEvents = eventCount > 0;
          const { visible, hiddenCount } = getVisibleEventChips(
            dayEvents,
            maxVisible
          );

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate(cell.dateKey)}
              title={
                hasEvents
                  ? `${cell.date.getDate()} — ${eventCount} etkinlik`
                  : undefined
              }
              className={[
                "group relative flex flex-col rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-1 sm:rounded-2xl",
                mini
                  ? "min-h-[36px] items-center justify-center p-1"
                  : viewMode === "week"
                    ? "min-h-[120px] min-w-[88px] p-2.5"
                    : compact
                      ? "min-h-[64px] p-1.5"
                      : "min-h-[88px] p-2",
                isSelected
                  ? "border-blue-200 bg-blue-50/50 ring-2 ring-blue-200/60"
                  : "border-transparent hover:border-slate-200/90 hover:bg-slate-50/80",
                cell.isToday && !isSelected
                  ? "border-blue-200 bg-blue-50/50"
                  : "",
                !cell.isCurrentMonth && viewMode === "month"
                  ? "opacity-40"
                  : "",
              ].join(" ")}
            >
              {mini ? (
                <>
                  <span
                    className={[
                      "inline-flex items-center justify-center rounded-full font-black",
                      cell.isToday
                        ? "h-6 min-w-6 bg-[#0f1f4d] text-[11px] text-white"
                        : "h-6 min-w-6 text-[11px] text-[#0f1f4d]",
                    ].join(" ")}
                  >
                    {cell.date.getDate()}
                  </span>
                  {hasEvents ? (
                    <span className="mt-0.5 size-1.5 rounded-full bg-blue-500" />
                  ) : (
                    <span className="mt-0.5 size-1.5" />
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={[
                        "inline-flex items-center justify-center rounded-full font-black",
                        cell.isToday
                          ? "h-7 min-w-7 bg-[#0f1f4d] text-xs text-white"
                          : "h-7 min-w-7 text-xs text-[#0f1f4d]",
                      ].join(" ")}
                    >
                      {cell.date.getDate()}
                    </span>
                    {eventCount > 0 ? (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                        {eventCount}
                      </span>
                    ) : null}
                  </div>

                  {maxVisible > 0 ? (
                    <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                      {visible.map((event) => (
                        <div
                          key={event.id}
                          role={onEventClick ? "button" : undefined}
                          tabIndex={onEventClick ? 0 : undefined}
                          onClick={
                            onEventClick
                              ? (clickEvent) => {
                                  clickEvent.stopPropagation();
                                  onEventClick(event);
                                }
                              : undefined
                          }
                          onKeyDown={
                            onEventClick
                              ? (keyEvent) => {
                                  if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                                    keyEvent.preventDefault();
                                    keyEvent.stopPropagation();
                                    onEventClick(event);
                                  }
                                }
                              : undefined
                          }
                          className={[
                            "truncate rounded-lg px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                            getCalendarEventPillClass(event),
                            onEventClick ? "cursor-pointer hover:opacity-90" : "",
                          ].join(" ")}
                          title={event.title}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span
                              className={[
                                "size-1.5 shrink-0 rounded-full",
                                getCalendarEventDotClass(event),
                              ].join(" ")}
                            />
                            <span className="truncate">{event.title}</span>
                          </span>
                        </div>
                      ))}
                      {hiddenCount > 0 ? (
                        <span className="px-1 text-[10px] font-bold text-slate-400">
                          +{hiddenCount} daha
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { toDateKey } from "@/lib/calendar-utils";
