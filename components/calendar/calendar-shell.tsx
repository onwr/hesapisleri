"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { CalendarEventDetails } from "@/components/calendar/calendar-event-details";
import { CalendarEventForm } from "@/components/calendar/calendar-event-form";
import type { CalendarEventFormValues } from "@/components/calendar/calendar-event-form";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { CalendarListView } from "@/components/calendar/calendar-list-view";
import { CalendarMobileDayView } from "@/components/calendar/calendar-mobile-day-view";
import { CalendarPageHeader } from "@/components/calendar/calendar-page-header";
import { CalendarSidePanel } from "@/components/calendar/calendar-side-panel";
import { CalendarSummaryCards } from "@/components/calendar/calendar-summary-cards";
import {
  CalendarToolbar,
  type CalendarViewMode,
} from "@/components/calendar/calendar-toolbar";
import { CalendarView, toDateKey } from "@/components/calendar/calendar-view";
import { CALENDAR_CARD_CLASS } from "@/components/calendar/calendar-ui-tokens";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  computeCalendarStats,
  DEFAULT_CALENDAR_EXTENDED_FILTERS,
  filterCalendarEvents,
  isCalendarEventCritical,
  type CalendarExtendedFilterState,
} from "@/lib/calendar-ui-utils";
import {
  endOfDay,
  startOfDay,
  type NormalizedCalendarEvent,
} from "@/lib/calendar-utils";

type CalendarShellProps = {
  mode?: "page" | "modal";
  onClose?: () => void;
};

const VIEW_STORAGE_KEY = "hesapisleri.calendar.view";

function parseViewMode(value: string | null): CalendarViewMode | null {
  if (value === "month" || value === "week" || value === "list") return value;
  return null;
}

function buildFetchParams(from: Date, to: Date, filters: CalendarExtendedFilterState) {
  const types: string[] = [];
  if (filters.showPayments) types.push("PAYMENT");
  if (filters.showAppointments) types.push("APPOINTMENT");
  if (filters.showReminders) types.push("REMINDER");

  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    types: types.length > 0 ? types.join(",") : "APPOINTMENT,PAYMENT,REMINDER",
    includeSystem: String(filters.showSystem),
  });
}

function formValuesToPayload(values: CalendarEventFormValues) {
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    startAt: new Date(values.startAt).toISOString(),
    endAt: values.endAt ? new Date(values.endAt).toISOString() : undefined,
    allDay: values.allDay,
    amount:
      values.type === "PAYMENT" && values.amount
        ? Number(values.amount)
        : undefined,
    currency: values.type === "PAYMENT" ? values.currency : undefined,
    status: values.status,
  };
}

function countActiveFilters(filters: CalendarExtendedFilterState) {
  let count = 0;
  if (!filters.showPayments || !filters.showAppointments || !filters.showReminders) {
    count += 1;
  }
  if (filters.sourceFilter !== "ALL") count += 1;
  if (filters.statusFilter !== "ALL") count += 1;
  if (filters.moduleFilter !== "ALL") count += 1;
  if (filters.dateFrom || filters.dateTo) count += 1;
  if (!filters.showSystem) count += 1;
  if (filters.searchQuery.trim()) count += 1;
  return count;
}

function useCompactViewport() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}

export function CalendarShell({ mode = "page", onClose }: CalendarShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const compactViewport = useCompactViewport();
  const today = new Date();
  const [anchorDate, setAnchorDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [detailEvent, setDetailEvent] = useState<NormalizedCalendarEvent | null>(
    null
  );
  const [filters, setFilters] = useState<CalendarExtendedFilterState>(
    DEFAULT_CALENDAR_EXTENDED_FILTERS
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [events, setEvents] = useState<NormalizedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultFormType, setDefaultFormType] =
    useState<CalendarEventFormValues["type"]>("APPOINTMENT");
  const [editingEvent, setEditingEvent] =
    useState<NormalizedCalendarEvent | null>(null);

  useEffect(() => {
    const fromUrl = parseViewMode(searchParams.get("view"));
    if (fromUrl) {
      setViewMode(fromUrl);
      return;
    }

    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      const fromStorage = parseViewMode(stored);
      if (fromStorage) setViewMode(fromStorage);
    } catch {
      // ignore storage errors
    }
  }, [searchParams]);

  function updateViewMode(next: CalendarViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const range = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = new Date(anchorDate);
      const offset = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - offset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return { from: startOfDay(weekStart), to: endOfDay(weekEnd) };
    }

    const from = startOfDay(
      new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
    );
    const to = endOfDay(
      new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
    );
    return { from, to };
  }, [anchorDate, viewMode]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const params = buildFetchParams(range.from, range.to, filters);
      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setEvents(json.events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filters.showAppointments, filters.showPayments, filters.showReminders, filters.showSystem, range.from, range.to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(
    () => filterCalendarEvents(events, filters),
    [events, filters]
  );

  const stats = useMemo(
    () => computeCalendarStats(filteredEvents),
    [filteredEvents]
  );

  const todayKey = toDateKey(new Date());
  const todayEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => toDateKey(new Date(event.startAt)) === todayKey
      ),
    [filteredEvents, todayKey]
  );

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return filteredEvents
      .filter((event) => {
        const time = new Date(event.startAt).getTime();
        return time >= now && !isCalendarEventCritical(event);
      })
      .sort(
        (left, right) =>
          new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
      );
  }, [filteredEvents]);

  const overdueEvents = useMemo(
    () => filteredEvents.filter(isCalendarEventCritical),
    [filteredEvents]
  );

  const periodLabel = useMemo(() => {
    if (viewMode === "week") {
      const weekStart = new Date(anchorDate);
      const offset = (weekStart.getDay() + 6) % 7;
      weekStart.setDate(weekStart.getDate() - offset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const fmt = new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
      });
      return `${fmt.format(weekStart)} – ${fmt.format(weekEnd)}`;
    }

    return new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(anchorDate);
  }, [anchorDate, viewMode]);

  function shiftAnchor(delta: number) {
    setAnchorDate((prev) => {
      if (viewMode === "week" || compactViewport) {
        const next = new Date(prev);
        next.setDate(prev.getDate() + delta * 7);
        return next;
      }

      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
    });
  }

  function goToday() {
    const now = new Date();
    setAnchorDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateKey(toDateKey(now));
  }

  function openNewForm(type: CalendarEventFormValues["type"] = "APPOINTMENT") {
    setEditingEvent(null);
    setDefaultFormType(type);
    setFormOpen(true);
  }

  async function handleSave(values: CalendarEventFormValues) {
    setSaving(true);

    try {
      const payload = formValuesToPayload(values);
      const res = await fetch(
        editingEvent
          ? `/api/calendar/events/${editingEvent.id}`
          : "/api/calendar/events",
        {
          method: editingEvent ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok || !json.success) return;

      setFormOpen(false);
      setEditingEvent(null);
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: NormalizedCalendarEvent) {
    if (!window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) {
      return;
    }

    const res = await fetch(`/api/calendar/events/${event.id}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (res.ok && json.success) {
      await loadEvents();
    }
  }

  async function handleComplete(event: NormalizedCalendarEvent) {
    if (event.readOnly) return;

    const res = await fetch(`/api/calendar/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });

    const json = await res.json();
    if (res.ok && json.success) {
      setDetailEvent(null);
      await loadEvents();
    }
  }

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  const showMobileDayView =
    mode === "page" && compactViewport && viewMode !== "list";

  return (
    <div className={mode === "page" ? "space-y-3" : "space-y-4"}>
      {mode === "page" ? (
        <>
          <CalendarPageHeader />
          <CalendarSummaryCards
            todayCount={stats.todayCount}
            weekCount={stats.weekCount}
            overdueCount={stats.criticalCount}
            upcomingPaymentCount={stats.upcomingPaymentCount}
          />
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[#0f1f4d]">Takvim</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      )}

      {loading ? (
        <div
          className={`${CALENDAR_CARD_CLASS} flex items-center justify-center py-20`}
        >
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-3">
            <CalendarToolbar
              periodLabel={periodLabel}
              viewMode={viewMode}
              onViewChange={updateViewMode}
              onPrevious={() => shiftAnchor(-1)}
              onToday={goToday}
              onNext={() => shiftAnchor(1)}
              onOpenFilters={
                mode === "page" ? () => setFiltersOpen(true) : undefined
              }
              onCreate={mode === "page" ? () => openNewForm() : undefined}
              activeFilterCount={countActiveFilters(filters)}
            />

            {showMobileDayView ? (
              <CalendarMobileDayView
                anchorDate={anchorDate}
                selectedDateKey={selectedDateKey}
                events={filteredEvents}
                onSelectDate={setSelectedDateKey}
                onPrevious={() => shiftAnchor(-1)}
                onNext={() => shiftAnchor(1)}
                onEventClick={(event) => setDetailEvent(event)}
                onAddEvent={() => openNewForm()}
              />
            ) : viewMode === "list" ? (
              <CalendarListView
                events={filteredEvents}
                onAddEvent={() => openNewForm()}
                onEventClick={(event) => setDetailEvent(event)}
              />
            ) : (
              <div className={`${CALENDAR_CARD_CLASS} hidden p-3 sm:p-4 xl:block`}>
                <CalendarView
                  viewMode={viewMode}
                  anchorDate={anchorDate}
                  events={filteredEvents}
                  selectedDateKey={selectedDateKey}
                  onSelectDate={setSelectedDateKey}
                  onEventClick={(event) => setDetailEvent(event)}
                  compact={mode === "modal"}
                  embedded
                />
              </div>
            )}
          </div>

          {mode === "page" ? (
            <div className="hidden xl:block">
              <CalendarSidePanel
                todayEvents={todayEvents}
                upcomingEvents={upcomingEvents}
                overdueEvents={overdueEvents}
                onEventClick={(event) => setDetailEvent(event)}
                onCreate={() => openNewForm()}
                onComplete={(event) => void handleComplete(event)}
              />
            </div>
          ) : null}
        </div>
      )}

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Takvim Filtreleri</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <CalendarFilters filters={filters} onChange={setFilters} embedded />
          </div>
        </SheetContent>
      </Sheet>

      <CalendarEventDetails
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onEdit={(event) => {
          setDetailEvent(null);
          setEditingEvent(event);
          setFormOpen(true);
        }}
        onDelete={(event) => void handleDelete(event)}
        onComplete={(event) => void handleComplete(event)}
      />

      {formOpen ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,31,77,0.2)] sm:rounded-[24px]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Takvim
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-[#0f1f4d]">
                  {editingEvent ? "Etkinliği Düzenle" : "Etkinlik Ekle"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {editingEvent
                    ? "Manuel etkinliğinizi güncelleyin."
                    : "Hatırlatma, ödeme veya randevu oluşturun."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingEvent(null);
                }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Formu kapat"
              >
                <X size={16} />
              </button>
            </div>
            <CalendarEventForm
              initialEvent={editingEvent}
              defaultDate={selectedDate}
              defaultType={defaultFormType}
              saving={saving}
              onSubmit={handleSave}
              onCancel={() => {
                setFormOpen(false);
                setEditingEvent(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
