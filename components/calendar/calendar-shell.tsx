"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Receipt,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { CalendarEventForm } from "@/components/calendar/calendar-event-form";
import type { CalendarEventFormValues } from "@/components/calendar/calendar-event-form";
import { CalendarEventList } from "@/components/calendar/calendar-event-list";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import { CalendarListView } from "@/components/calendar/calendar-list-view";
import { CalendarView, toDateKey } from "@/components/calendar/calendar-view";
import {
  CALENDAR_CARD_CLASS,
  CALENDAR_STATS_BAR_CLASS,
} from "@/components/calendar/calendar-ui-tokens";
import { Button } from "@/components/ui/button";
import {
  computeCalendarStats,
  DEFAULT_CALENDAR_EXTENDED_FILTERS,
  filterCalendarEvents,
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

type ViewMode = "month" | "week" | "list";

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

function ViewToggle({
  viewMode,
  onChange,
  compact = false,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  compact?: boolean;
}) {
  const items: Array<{ mode: ViewMode; label: string }> = [
    { mode: "month", label: "Ay" },
    { mode: "week", label: "Hafta" },
    { mode: "list", label: "Liste" },
  ];

  return (
    <div
      className={[
        "inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5",
        compact ? "text-[11px]" : "text-[12px]",
      ].join(" ")}
    >
      {items.map((item) => (
        <button
          key={item.mode}
          type="button"
          onClick={() => onChange(item.mode)}
          className={[
            "rounded-md px-2.5 py-1.5 font-black transition",
            viewMode === item.mode
              ? "bg-white text-[#0f1f4d] shadow-sm"
              : "text-slate-500 hover:text-[#0f1f4d]",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ToolbarButton({
  children,
  primary = false,
  onClick,
}: {
  children: ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f1f4d] px-3 text-[12px] font-black text-white transition hover:bg-[#162a5c]"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function ToolbarLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "amber" | "rose" | "blue" | "violet";
}) {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "blue"
          ? "bg-blue-50 text-blue-700"
          : tone === "violet"
            ? "bg-violet-50 text-violet-700"
            : "bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${toneClass}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {label}
      </span>
      <p className="text-[13px] font-black leading-tight">{value}</p>
    </div>
  );
}

export function CalendarShell({ mode = "page", onClose }: CalendarShellProps) {
  const today = new Date();
  const [anchorDate, setAnchorDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [filters, setFilters] = useState<CalendarExtendedFilterState>(
    DEFAULT_CALENDAR_EXTENDED_FILTERS
  );
  const [events, setEvents] = useState<NormalizedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [defaultFormType, setDefaultFormType] =
    useState<CalendarEventFormValues["type"]>("APPOINTMENT");
  const [editingEvent, setEditingEvent] =
    useState<NormalizedCalendarEvent | null>(null);

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

  const selectedDayEvents = useMemo(
    () =>
      filteredEvents.filter(
        (event) => toDateKey(new Date(event.startAt)) === selectedDateKey
      ),
    [filteredEvents, selectedDateKey]
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
      if (viewMode === "week") {
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

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDateKey]);

  return (
    <div className={mode === "page" ? "space-y-3" : "space-y-4"}>
      {mode === "page" ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                Takvim
              </h1>
              <p className="text-[12px] font-medium text-slate-500">
                Ödemeler, izinler, bordrolar ve iş takipleri
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ViewToggle viewMode={viewMode} onChange={setViewMode} compact />
              <ToolbarButton primary onClick={() => openNewForm()}>
                <Plus size={14} />
                Etkinlik Ekle
              </ToolbarButton>
              <ToolbarLink href="/cash-bank">
                <Wallet size={14} />
                Kasa & Banka
              </ToolbarLink>
              <ToolbarLink href="/team">
                <UserRound size={14} />
                Çalışanlar
              </ToolbarLink>
              <ToolbarLink href="/team/payroll">
                <Receipt size={14} />
                Bordro
              </ToolbarLink>
            </div>
          </div>

          <section className={CALENDAR_STATS_BAR_CLASS}>
            <StatPill label="Bugün" value={String(stats.todayCount)} tone="blue" />
            <StatPill label="Bu Hafta" value={String(stats.weekCount)} tone="violet" />
            <StatPill
              label="Yaklaşan Ödeme"
              value={String(stats.upcomingPaymentCount)}
              tone="amber"
            />
            <StatPill
              label="İzin / Personel"
              value={String(stats.staffCount)}
              tone="violet"
            />
            <StatPill
              label="Geciken"
              value={String(stats.criticalCount)}
              tone={stats.criticalCount > 0 ? "rose" : "slate"}
            />
          </section>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-blue-600" size={20} />
            <h2 className="text-lg font-black text-[#0f1f4d]">Takvim</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      )}

      <CalendarFilters filters={filters} onChange={setFilters} />

      {loading ? (
        <div
          className={`${CALENDAR_CARD_CLASS} flex items-center justify-center py-20`}
        >
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div
          className={[
            "grid gap-6",
            mode === "page" && viewMode !== "list"
              ? "xl:grid-cols-[1.45fr_0.85fr]"
              : "",
          ].join(" ")}
        >
          <div className="space-y-4">
            {viewMode !== "list" ? (
              <div className={`${CALENDAR_CARD_CLASS} p-4 sm:p-5`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold capitalize text-[#0f1f4d] sm:text-lg">
                      {periodLabel}
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500">
                      {viewMode === "month" ? "Aylık görünüm" : "Haftalık görünüm"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => shiftAnchor(-1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        aria-label="Önceki dönem"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={goToday}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-[11px] font-black text-[#0f1f4d] transition hover:bg-slate-50"
                      >
                        Bugün
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftAnchor(1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        aria-label="Sonraki dönem"
                      >
                        <ChevronRight size={16} />
                      </button>
                    {mode !== "page" ? (
                      <ViewToggle
                        viewMode={viewMode}
                        onChange={setViewMode}
                        compact
                      />
                    ) : null}
                  </div>
                </div>

                <CalendarView
                  viewMode={viewMode}
                  anchorDate={anchorDate}
                  events={filteredEvents}
                  selectedDateKey={selectedDateKey}
                  onSelectDate={setSelectedDateKey}
                  compact={mode === "modal"}
                  embedded
                />
              </div>
            ) : (
              <>
                <div className={`${CALENDAR_CARD_CLASS} p-4 sm:p-5`}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-extrabold capitalize text-[#0f1f4d] sm:text-lg">
                        {periodLabel}
                      </h2>
                      <p className="text-[11px] font-medium text-slate-500">
                        Liste görünümü
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => shiftAnchor(-1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-blue-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={goToday}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-[11px] font-black text-[#0f1f4d]"
                      >
                        Bugün
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftAnchor(1)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-blue-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                      {mode !== "page" ? (
                        <ViewToggle
                          viewMode={viewMode}
                          onChange={setViewMode}
                          compact
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
                <CalendarListView events={filteredEvents} />
              </>
            )}
          </div>

          {viewMode !== "list" ? (
            <aside
              className={[
                mode === "page" ? "xl:sticky xl:top-24 xl:self-start" : "",
              ].join(" ")}
            >
              <div className={`${CALENDAR_CARD_CLASS} p-5`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Seçili Gün
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold capitalize text-[#0f1f4d]">
                      {new Intl.DateTimeFormat("tr-TR", {
                        day: "numeric",
                        month: "long",
                        weekday: "long",
                      }).format(selectedDate)}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedDayEvents.length} etkinlik
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                    {selectedDayEvents.length}
                  </span>
                </div>

                {mode === "page" ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openNewForm("REMINDER")}
                      className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-[#0f1f4d] transition hover:bg-white"
                    >
                      + Hatırlatma
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewForm("PAYMENT")}
                      className="rounded-xl border border-orange-200/80 bg-orange-50/60 px-3 py-1.5 text-[11px] font-bold text-orange-700"
                    >
                      + Ödeme
                    </button>
                  </div>
                ) : null}

                <CalendarEventList
                  events={selectedDayEvents}
                  onEdit={(event) => {
                    setEditingEvent(event);
                    setFormOpen(true);
                  }}
                  onDelete={(event) => void handleDelete(event)}
                  onAddEvent={mode === "modal" ? () => openNewForm() : undefined}
                  emptyMessage="Bu gün için etkinlik bulunmuyor."
                  emptyDescription={
                    mode === "page"
                      ? "Üstteki Etkinlik Ekle butonunu kullanabilir veya başka bir gün seçebilirsiniz."
                      : "Manuel etkinlik ekleyebilir veya başka bir gün seçebilirsiniz."
                  }
                  compact={mode === "modal"}
                />
              </div>

              {mode === "modal" ? (
                <Button asChild className="mt-4 w-full rounded-2xl">
                  <Link href="/calendar">Tam Takvimi Aç</Link>
                </Button>
              ) : null}
            </aside>
          ) : null}
        </div>
      )}

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
