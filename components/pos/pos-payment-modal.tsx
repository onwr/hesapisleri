"use client";

import {
  Banknote,
  CreditCard,
  Loader2,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { PosCollectionAccountSelect } from "@/components/pos/pos-collection-account-select";
import { POS_INPUT_CLASS } from "@/components/pos/pos-ui-tokens";
import { calculatePosChange } from "@/lib/pos-page-utils";
import type { PosPaymentMethod } from "@/lib/pos-checkout-utils";
import type { PosCollectionAccount } from "@/lib/pos-payment-account-utils";
import {
  filterPosAccountsForMethod,
} from "@/lib/pos-payment-account-utils";
import { sumPosPaymentAmounts } from "@/lib/pos-checkout-utils";
import { roundMoney } from "@/lib/sale-payment-utils";

export type PosPaymentLineState = {
  id: string;
  paymentMethod: PosPaymentMethod;
  amount: string;
  accountId: string;
};

type CustomerOption = {
  id: string;
  name: string;
};

type PosPaymentModalProps = {
  open: boolean;
  total: number;
  paymentMode: "single" | "split";
  paymentLines: PosPaymentLineState[];
  accounts: PosCollectionAccount[];
  accountsLoading: boolean;
  receivedAmount: string;
  note: string;
  selectedCustomerId: string;
  customers: CustomerOption[];
  checkingOut: boolean;
  error: string;
  hideCreditOptions?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPaymentModeChange: (mode: "single" | "split") => void;
  onPaymentLinesChange: (lines: PosPaymentLineState[]) => void;
  onReceivedAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCustomerChange: (customerId: string) => void;
  formatMoney: (value: number) => string;
};

const PAYMENT_METHODS: Array<{
  value: PosPaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { value: "CASH", label: "Nakit", icon: Banknote },
  { value: "CARD", label: "Kart", icon: CreditCard },
  { value: "BANK_TRANSFER", label: "Havale/EFT", icon: Wallet },
];

function createPaymentLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultPosPaymentLine(
  total: number,
  paymentMethod: PosPaymentMethod = "CASH"
): PosPaymentLineState {
  return {
    id: createPaymentLineId(),
    paymentMethod,
    amount: String(total),
    accountId: "",
  };
}

export function validatePosPaymentLines(input: {
  lines: PosPaymentLineState[];
  total: number;
  accounts: PosCollectionAccount[];
}) {
  if (input.lines.length === 0) {
    return "En az bir ödeme satırı ekleyin.";
  }

  const numericLines = input.lines.map((line) => ({
    ...line,
    amountValue: Number(line.amount) || 0,
  }));

  if (numericLines.some((line) => line.amountValue <= 0)) {
    return "Her ödeme satırında tutar sıfırdan büyük olmalıdır.";
  }

  if (numericLines.some((line) => !line.accountId)) {
    return "Her ödeme satırı için tahsilat hesabı seçilmelidir.";
  }

  for (const line of numericLines) {
    const eligible = filterPosAccountsForMethod(input.accounts, line.paymentMethod);
    if (!eligible.some((account) => account.id === line.accountId)) {
      return "Seçilen hesap bu ödeme yöntemi için uygun değil.";
    }
  }

  const paidTotal = sumPosPaymentAmounts(
    numericLines.map((line) => ({ amount: line.amountValue }))
  );

  if (paidTotal !== roundMoney(input.total)) {
    return `Ödeme toplamı (${paidTotal}) satış toplamına (${roundMoney(input.total)}) eşit olmalıdır.`;
  }

  return null;
}

export function PosPaymentModal({
  open,
  total,
  paymentMode,
  paymentLines,
  accounts,
  accountsLoading,
  receivedAmount,
  note,
  selectedCustomerId,
  customers,
  checkingOut,
  error,
  hideCreditOptions = false,
  onClose,
  onConfirm,
  onPaymentModeChange,
  onPaymentLinesChange,
  onReceivedAmountChange,
  onNoteChange,
  onCustomerChange,
  formatMoney,
}: PosPaymentModalProps) {
  if (!open) return null;

  const primaryLine = paymentLines[0];
  const received = Number(receivedAmount) || 0;
  const change =
    primaryLine?.paymentMethod === "CASH"
      ? calculatePosChange(received, total)
      : 0;

  const paidPreview = sumPosPaymentAmounts(
    paymentLines.map((line) => ({
      amount: Number(line.amount) || 0,
    }))
  );

  function updateLine(
    lineId: string,
    patch: Partial<Pick<PosPaymentLineState, "paymentMethod" | "amount" | "accountId">>
  ) {
    onPaymentLinesChange(
      paymentLines.map((line) => {
        if (line.id !== lineId) return line;

        const next = { ...line, ...patch };
        if (patch.paymentMethod && patch.paymentMethod !== line.paymentMethod) {
          const stillValid = filterPosAccountsForMethod(
            accounts,
            patch.paymentMethod
          ).some((account) => account.id === next.accountId);
          if (!stillValid) {
            next.accountId = "";
          }
        }
        return next;
      })
    );
  }

  function addSplitLine() {
    onPaymentLinesChange([
      ...paymentLines,
      createDefaultPosPaymentLine(0, "CARD"),
    ]);
  }

  function removeSplitLine(lineId: string) {
    if (paymentLines.length <= 1) return;
    onPaymentLinesChange(paymentLines.filter((line) => line.id !== lineId));
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        data-testid="pos-payment-modal"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,31,77,0.2)] sm:rounded-[24px]"
      >
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Ödeme
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-[#0f1f4d]">
            Ödeme Al
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Toplam tutar:{" "}
            <span className="font-extrabold text-[#0f1f4d]">
              {formatMoney(total)}
            </span>
          </p>
        </div>

        <div className="mb-4 flex gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onPaymentModeChange("single")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
              paymentMode === "single"
                ? "bg-white text-[#0f1f4d] shadow-sm"
                : "text-slate-500",
            ].join(" ")}
          >
            Tek Ödeme
          </button>
          <button
            type="button"
            onClick={() => onPaymentModeChange("split")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
              paymentMode === "split"
                ? "bg-white text-[#0f1f4d] shadow-sm"
                : "text-slate-500",
            ].join(" ")}
          >
            Parçalı Ödeme
          </button>
        </div>

        <div className="space-y-4">
          {accountsLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
              <Loader2 className="animate-spin" size={16} />
              Tahsilat hesapları yükleniyor...
            </div>
          ) : null}

          {paymentLines.map((line, index) => (
            <div
              key={line.id}
              className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-black text-[#0f1f4d]">
                  Ödeme {index + 1}
                </p>
                {paymentMode === "split" && paymentLines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSplitLine(line.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50"
                    aria-label="Ödeme satırını sil"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const active = line.paymentMethod === method.value;

                  return (
                    <button
                      key={`${line.id}-${method.value}`}
                      type="button"
                      onClick={() =>
                        updateLine(line.id, { paymentMethod: method.value })
                      }
                      className={[
                        "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] font-bold transition",
                        active
                          ? "border-[#0f1f4d] bg-[#0f1f4d] text-white"
                          : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <Icon size={16} />
                      {method.label}
                    </button>
                  );
                })}
              </div>

              {paymentMode === "split" ? (
                <div>
                  <label className="mb-2 block text-sm font-bold text-[#24345f]">
                    Tutar
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(line.id, { amount: event.target.value })
                    }
                    className={POS_INPUT_CLASS}
                    placeholder="0,00"
                  />
                </div>
              ) : null}

              <PosCollectionAccountSelect
                accounts={accounts}
                paymentMethod={line.paymentMethod}
                value={line.accountId}
                onChange={(accountId) => updateLine(line.id, { accountId })}
                disabled={checkingOut || accountsLoading}
                className={POS_INPUT_CLASS}
              />
            </div>
          ))}

          {paymentMode === "split" ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={addSplitLine}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200/80 px-4 text-[12px] font-bold text-[#0f1f4d] hover:bg-slate-50"
              >
                <Plus size={14} />
                Ödeme satırı ekle
              </button>
              <p className="text-[12px] font-semibold text-slate-500">
                Toplanan:{" "}
                <span
                  className={
                    paidPreview === roundMoney(total)
                      ? "font-black text-emerald-600"
                      : "font-black text-rose-600"
                  }
                >
                  {formatMoney(paidPreview)}
                </span>
              </p>
            </div>
          ) : null}

          {paymentMode === "single" && primaryLine?.paymentMethod === "CASH" ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-[#24345f]">
                Alınan tutar
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={receivedAmount}
                onChange={(e) => onReceivedAmountChange(e.target.value)}
                className={POS_INPUT_CLASS}
                placeholder="0,00"
              />
              {received > 0 ? (
                <p className="mt-2 text-sm font-bold text-emerald-600">
                  Para üstü: {formatMoney(change)}
                </p>
              ) : null}
            </div>
          ) : null}

          {!hideCreditOptions ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-[#24345f]">
                Müşteri (opsiyonel)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => onCustomerChange(e.target.value)}
                className={POS_INPUT_CLASS}
              >
                <option value="">Perakende satış</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-bold text-[#24345f]">
              Not (opsiyonel)
            </label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              className="min-h-20 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-medium text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="Satış notu..."
            />
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={checkingOut}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200/80 px-4 text-sm font-bold text-slate-600"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={checkingOut || accountsLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] hover:bg-[#162a5c] disabled:opacity-50"
          >
            {checkingOut ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Onaylanıyor...
              </>
            ) : (
              <>
                Satışı Onayla{" "}
                <kbd className="hidden rounded border border-white/30 px-1 text-[10px] font-semibold xl:inline">
                  Ctrl+↵
                </kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
