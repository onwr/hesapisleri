"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import { formatMoney } from "@/lib/format-utils";
import { calculatePayrollItemNetPayable } from "@/lib/payroll-utils";
import type { SerializedPayrollRun } from "@/lib/payroll-service";

type PayrollItem = SerializedPayrollRun["items"][number];

type PayrollItemEditModalProps = {
  open: boolean;
  item: PayrollItem | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: {
    bonusAmount: number;
    deductionAmount: number;
    advanceDeduction: number;
    notes: string;
  }) => void;
};

export function PayrollItemEditModal({
  open,
  item,
  saving,
  error,
  onClose,
  onSave,
}: PayrollItemEditModalProps) {
  const [bonusAmount, setBonusAmount] = useState("0");
  const [deductionAmount, setDeductionAmount] = useState("0");
  const [advanceDeduction, setAdvanceDeduction] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!item) return;
    setBonusAmount(String(item.bonusAmount));
    setDeductionAmount(String(item.deductionAmount));
    setAdvanceDeduction(String(item.advanceDeduction));
    setNotes(item.notes ?? "");
  }, [item]);

  const liveNet = useMemo(() => {
    if (!item) return 0;
    return calculatePayrollItemNetPayable({
      baseSalary: item.baseSalary,
      bonusAmount: Number(bonusAmount) || 0,
      deductionAmount: Number(deductionAmount) || 0,
      advanceDeduction: Number(advanceDeduction) || 0,
    });
  }, [item, bonusAmount, deductionAmount, advanceDeduction]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className={[TEAM_CARD_CLASS, "w-full max-w-lg space-y-4 p-6 shadow-xl"].join(" ")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#0f1f4d]">Kalem düzenle</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {item.employeeName}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase text-slate-400">Baz maaş</p>
          <p className="mt-1 text-lg font-black text-[#0f1f4d]">
            {formatMoney(item.baseSalary)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Prim</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Kesinti</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={deductionAmount}
              onChange={(e) => setDeductionAmount(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500">Avans düşümü</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={advanceDeduction}
              onChange={(e) => setAdvanceDeduction(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-500">Not</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Kalem notu"
          />
        </label>

        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-[11px] font-black uppercase text-emerald-700">
            Net ödenecek
          </p>
          <p className="mt-1 text-xl font-black text-emerald-800">
            {formatMoney(liveNet)}
          </p>
          {liveNet === 0 ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Net tutar sıfır. Bu kalem için ödeme kaydı oluşturulmayabilir.
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border px-4 text-xs font-black"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                bonusAmount: Number(bonusAmount) || 0,
                deductionAmount: Number(deductionAmount) || 0,
                advanceDeduction: Number(advanceDeduction) || 0,
                notes,
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
