"use client";

import { Loader2, X } from "lucide-react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";

type EmployeePaymentCancelModalProps = {
  open: boolean;
  saving: boolean;
  paymentLabel: string;
  paymentAmount: number;
  requiresReason: boolean;
  reason: string;
  formError: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function EmployeePaymentCancelModal({
  open,
  saving,
  paymentLabel,
  paymentAmount,
  requiresReason,
  reason,
  formError,
  onReasonChange,
  onClose,
  onSubmit,
}: EmployeePaymentCancelModalProps) {
  if (!open) return null;

  const canSubmit = !requiresReason || reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={[
          TEAM_CARD_CLASS,
          "w-full max-w-lg space-y-5 p-6 shadow-xl",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#0f1f4d]">Ödemeyi iptal et</h3>
            <p className="mt-1 text-sm text-slate-500">
              {paymentLabel} · {formatMoney(paymentAmount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-500">
          Ödenmiş kayıtlar için bağlı gider ve kasa/banka hareketi ters kayıt ile
          iptal edilir. Bu işlem geri alınamaz.
        </p>

        {requiresReason ? (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">İptal nedeni</span>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="İptal nedenini yazın"
            />
          </label>
        ) : null}

        {formError ? (
          <p className="text-sm font-semibold text-red-600">{formError}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !canSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            İptal Et
          </button>
        </div>
      </div>
    </div>
  );
}
