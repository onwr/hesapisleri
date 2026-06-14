"use client";

import { useEffect, useState } from "react";
import { Bell, Calendar, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NormalizedCalendarEvent } from "@/lib/calendar-utils";

export type CalendarEventFormValues = {
  type: "APPOINTMENT" | "PAYMENT" | "REMINDER";
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  amount: string;
  currency: "TRY" | "USD" | "EUR";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
};

type CalendarEventFormProps = {
  initialEvent?: NormalizedCalendarEvent | null;
  defaultDate?: Date | null;
  defaultType?: CalendarEventFormValues["type"];
  saving?: boolean;
  onSubmit: (values: CalendarEventFormValues) => Promise<void>;
  onCancel: () => void;
};

const TYPE_OPTIONS: Array<{
  value: CalendarEventFormValues["type"];
  label: string;
  icon: typeof Calendar;
  activeClass: string;
}> = [
  {
    value: "APPOINTMENT",
    label: "Randevu",
    icon: Calendar,
    activeClass: "border-blue-300 bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/60",
  },
  {
    value: "PAYMENT",
    label: "Ödeme",
    icon: Wallet,
    activeClass:
      "border-orange-300 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100/60",
  },
  {
    value: "REMINDER",
    label: "Hatırlatma",
    icon: Bell,
    activeClass:
      "border-violet-300 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/60",
  },
];

function toLocalInputValue(date: Date, allDay: boolean) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  if (allDay) return `${year}-${month}-${day}T09:00`;

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildInitialValues(
  initialEvent?: NormalizedCalendarEvent | null,
  defaultDate?: Date | null,
  defaultType?: CalendarEventFormValues["type"]
): CalendarEventFormValues {
  if (initialEvent) {
    return {
      type: initialEvent.type,
      title: initialEvent.title,
      description: initialEvent.description ?? "",
      startAt: toLocalInputValue(
        new Date(initialEvent.startAt),
        initialEvent.allDay
      ),
      endAt: initialEvent.endAt
        ? toLocalInputValue(new Date(initialEvent.endAt), initialEvent.allDay)
        : "",
      allDay: initialEvent.allDay,
      amount: initialEvent.amount != null ? String(initialEvent.amount) : "",
      currency: (initialEvent.currency as "TRY" | "USD" | "EUR") ?? "TRY",
      status: initialEvent.status,
    };
  }

  const baseDate = defaultDate ?? new Date();
  return {
    type: defaultType ?? "APPOINTMENT",
    title: "",
    description: "",
    startAt: toLocalInputValue(baseDate, false),
    endAt: "",
    allDay: false,
    amount: "",
    currency: "TRY",
    status: "SCHEDULED",
  };
}

export function CalendarEventForm({
  initialEvent,
  defaultDate,
  defaultType,
  saving = false,
  onSubmit,
  onCancel,
}: CalendarEventFormProps) {
  const [form, setForm] = useState<CalendarEventFormValues>(() =>
    buildInitialValues(initialEvent, defaultDate, defaultType)
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(buildInitialValues(initialEvent, defaultDate, defaultType));
    setError("");
  }, [initialEvent, defaultDate, defaultType]);

  function updateField<K extends keyof CalendarEventFormValues>(
    key: K,
    value: CalendarEventFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.title.trim().length < 1) {
      setError("Başlık zorunludur.");
      return;
    }

    if (!form.startAt) {
      setError("Başlangıç tarihi zorunludur.");
      return;
    }

    await onSubmit(form);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div className="space-y-2.5">
        <Label className="text-xs font-black uppercase tracking-wide text-slate-400">
          Kayıt türü
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = form.type === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => updateField("type", option.value)}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                  active
                    ? option.activeClass
                    : "border-slate-200/90 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                ].join(" ")}
              >
                <Icon size={16} strokeWidth={2.25} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-bold text-[#24345f]">Başlık *</Label>
          <Input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="h-11 rounded-2xl border-slate-200/90 bg-white"
            placeholder="Örn. Müşteri görüşmesi"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-bold text-[#24345f]">Açıklama</Label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="min-h-24 w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-medium text-[#0f1f4d] outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            placeholder="Opsiyonel not"
            disabled={saving}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          Tarih ve saat
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm font-bold text-[#24345f]">
              Başlangıç *
            </Label>
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => updateField("startAt", e.target.value)}
              className="h-11 rounded-2xl border-slate-200/90 bg-white"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold text-[#24345f]">Bitiş</Label>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => updateField("endAt", e.target.value)}
              className="h-11 rounded-2xl border-slate-200/90 bg-white"
              disabled={saving}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={form.allDay}
            onChange={(e) => updateField("allDay", e.target.checked)}
            disabled={saving}
            className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
          />
          Tüm gün etkinliği
        </label>
      </div>

      {form.type === "PAYMENT" ? (
        <div className="rounded-2xl border border-orange-200/70 bg-orange-50/30 p-4 space-y-4">
          <p className="text-xs font-black uppercase tracking-wide text-orange-600/80">
            Ödeme detayı
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-[#24345f]">Tutar</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => updateField("amount", e.target.value)}
                className="h-11 rounded-2xl border-orange-200/60 bg-white"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-[#24345f]">
                Para birimi
              </Label>
              <Select
                value={form.currency}
                onValueChange={(value: CalendarEventFormValues["currency"]) =>
                  updateField("currency", value)
                }
                disabled={saving}
              >
                <SelectTrigger className="h-11 rounded-2xl border-orange-200/60 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-sm font-bold text-[#24345f]">Durum</Label>
        <Select
          value={form.status}
          onValueChange={(value: CalendarEventFormValues["status"]) =>
            updateField("status", value)
          }
          disabled={saving}
        >
          <SelectTrigger className="h-11 rounded-2xl border-slate-200/90 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SCHEDULED">Planlandı</SelectItem>
            <SelectItem value="COMPLETED">Tamamlandı</SelectItem>
            <SelectItem value="CANCELLED">İptal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
          className="rounded-2xl border-slate-200/90"
        >
          Vazgeç
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-linear-to-r from-blue-600 to-violet-600 shadow-md shadow-blue-200/40"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Kaydediliyor...
            </>
          ) : initialEvent ? (
            "Güncelle"
          ) : (
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}
