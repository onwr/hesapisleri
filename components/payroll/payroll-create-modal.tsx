"use client";

import { Loader2, X } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";

type PayrollPreview = {
  employeeCount: number;
  grossTotal: number;
  bonusTotal: number;
  deductionTotal: number;
  netTotal: number;
  warnings: Array<{ employeeId: string; employeeName: string; reason: string }>;
};

type PayrollCreateModalProps = {
  open: boolean;
  saving: boolean;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  title: string;
  preview: PayrollPreview | null;
  previewLoading: boolean;
  formError: string;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onPayDateChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function PayrollCreateModal({
  open,
  saving,
  periodStart,
  periodEnd,
  payDate,
  title,
  preview,
  previewLoading,
  formError,
  onPeriodStartChange,
  onPeriodEndChange,
  onPayDateChange,
  onTitleChange,
  onClose,
  onSubmit,
}: PayrollCreateModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={[TEAM_CARD_CLASS, "w-full max-w-xl space-y-5 p-6 shadow-xl"].join(" ")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#0f1f4d]">
              Yeni Bordro Dönemi
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Aktif çalışanları ve aktif maaşları kullanarak hesapla
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Dönem başlangıç</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => onPeriodStartChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Dönem bitiş</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => onPeriodEndChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Ödeme tarihi</span>
            <input
              type="date"
              value={payDate}
              onChange={(e) => onPayDateChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-bold text-slate-500">Başlık</span>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Opsiyonel"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Önizleme hesaplanıyor...
            </div>
          ) : preview ? (
            <div className="space-y-2 text-sm">
              <p className="font-black text-[#0f1f4d]">
                {preview.employeeCount} çalışan dahil · Net{" "}
                {formatMoney(preview.netTotal)}
              </p>
              <p className="text-slate-500">
                Brüt {formatMoney(preview.grossTotal)} · Prim{" "}
                {formatMoney(preview.bonusTotal)} · Kesinti{" "}
                {formatMoney(preview.deductionTotal)}
              </p>
              {preview.warnings.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-amber-700">
                  {preview.warnings.slice(0, 5).map((warning) => (
                    <p key={warning.employeeId}>
                      {warning.employeeName}: {warning.reason}
                    </p>
                  ))}
                  {preview.warnings.length > 5 ? (
                    <p>+{preview.warnings.length - 5} uyarı daha</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Tarihleri seçince önizleme otomatik güncellenir.
            </p>
          )}
        </div>

        {formError ? (
          <p className="text-sm font-semibold text-red-600">{formError}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !periodStart || !periodEnd}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Bordro Oluştur
          </button>
        </div>
      </div>
    </div>
  );
}

function getDefaultMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    payDate: end.toISOString().slice(0, 10),
  };
}

export { getDefaultMonthRange };
