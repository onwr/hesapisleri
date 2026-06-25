"use client";

import { Loader2, X } from "lucide-react";
import { FinanceAccountSelect } from "@/components/cash-bank/finance-account-select";
import { TEAM_CARD_CLASS } from "@/components/team/team-ui-tokens";
import {
  validateEmployeePaymentMarkPaidForm,
} from "@/lib/employee-payment-finance-utils";
import {
  EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL,
  EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";
import { formatMoney } from "@/lib/format-utils";

type EmployeePaymentMarkPaidModalProps = {
  open: boolean;
  saving: boolean;
  paymentLabel: string;
  paymentAmount: number;
  accounts: FinanceAccountOption[];
  accountsLoading: boolean;
  paidAt: string;
  relatedAccountId: string;
  notes: string;
  formError: string;
  onPaidAtChange: (value: string) => void;
  onRelatedAccountIdChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function EmployeePaymentMarkPaidModal({
  open,
  saving,
  paymentLabel,
  paymentAmount,
  accounts,
  accountsLoading,
  paidAt,
  relatedAccountId,
  notes,
  formError,
  onPaidAtChange,
  onRelatedAccountIdChange,
  onNotesChange,
  onClose,
  onSubmit,
}: EmployeePaymentMarkPaidModalProps) {
  if (!open) return null;

  const validationError = validateEmployeePaymentMarkPaidForm({
    relatedAccountId,
  });

  const canSubmit =
    accounts.length > 0 && !validationError && !accountsLoading;

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
            <h3 className="text-lg font-black text-[#0f1f4d]">
              Ödendi işaretle
            </h3>
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
          Seçilen hesaptan personel gideri ve kasa/banka hareketi oluşturulur;
          ödeme kaydı ödendi yapılır.
        </p>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">
              Ödeme tarihi
            </span>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => onPaidAtChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </label>

          <FinanceAccountSelect
            accounts={accounts}
            value={relatedAccountId}
            onChange={onRelatedAccountIdChange}
            disabled={accountsLoading}
            required
            emptyMessage={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE}
            emptyLinkLabel={EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50"
          />

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-500">Not</span>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opsiyonel not"
            />
          </label>
        </div>

        {validationError || formError ? (
          <p className="text-sm font-semibold text-red-600">
            {validationError ?? formError}
          </p>
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Ödendi işaretle
          </button>
        </div>
      </div>
    </div>
  );
}
