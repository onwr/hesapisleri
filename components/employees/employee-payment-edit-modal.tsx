"use client";

import { Loader2, X } from "lucide-react";
import { FinanceAccountSelect } from "@/components/cash-bank/finance-account-select";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import {
  EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";

type EmployeePaymentEditModalProps = {
  open: boolean;
  saving: boolean;
  paymentLabel: string;
  paymentAmount: string;
  dueDate: string;
  description: string;
  relatedAccountId: string;
  accounts: FinanceAccountOption[];
  accountsLoading: boolean;
  showAccountField: boolean;
  accountRequired: boolean;
  formError: string;
  onDueDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onRelatedAccountIdChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function EmployeePaymentEditModal({
  open,
  saving,
  paymentLabel,
  paymentAmount,
  dueDate,
  description,
  relatedAccountId,
  accounts,
  accountsLoading,
  showAccountField,
  accountRequired,
  formError,
  onDueDateChange,
  onAmountChange,
  onDescriptionChange,
  onRelatedAccountIdChange,
  onClose,
  onSubmit,
}: EmployeePaymentEditModalProps) {
  if (!open) return null;

  const amountValue = Number(paymentAmount);
  const canSubmit =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    (!accountRequired || relatedAccountId.trim().length > 0);

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
            <h3 className="text-lg font-black text-[#0f1f4d]">Ödemeyi düzenle</h3>
            <p className="mt-1 text-sm text-slate-500">{paymentLabel}</p>
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

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Tutar</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Vade / tarih</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opsiyonel açıklama"
            />
          </label>

          {showAccountField ? (
            <FinanceAccountSelect
              accounts={accounts}
              value={relatedAccountId}
              onChange={onRelatedAccountIdChange}
              disabled={accountsLoading}
              required={accountRequired}
              showBalance
              showSetupLink={false}
              label="Ödeme hesabı"
              emptyMessage={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50"
            />
          ) : null}
        </div>

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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1f4d] px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>

        <p className="text-[11px] font-medium text-slate-500">
          Kayıt tutarı güncellenecek.
        </p>
      </div>
    </div>
  );
}
