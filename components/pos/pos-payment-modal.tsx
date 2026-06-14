"use client";

import {
  Banknote,
  CreditCard,
  Loader2,
  Wallet,
} from "lucide-react";
import { POS_INPUT_CLASS } from "@/components/pos/pos-ui-tokens";
import { calculatePosChange } from "@/lib/pos-page-utils";
import type { PosPaymentMethod } from "@/lib/pos-checkout-utils";

type CustomerOption = {
  id: string;
  name: string;
};

type PosPaymentModalProps = {
  open: boolean;
  total: number;
  paymentMethod: PosPaymentMethod;
  receivedAmount: string;
  note: string;
  selectedCustomerId: string;
  customers: CustomerOption[];
  checkingOut: boolean;
  error: string;
  hideCreditOptions?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPaymentMethodChange: (method: PosPaymentMethod) => void;
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

export function PosPaymentModal({
  open,
  total,
  paymentMethod,
  receivedAmount,
  note,
  selectedCustomerId,
  customers,
  checkingOut,
  error,
  hideCreditOptions = false,
  onClose,
  onConfirm,
  onPaymentMethodChange,
  onReceivedAmountChange,
  onNoteChange,
  onCustomerChange,
  formatMoney,
}: PosPaymentModalProps) {
  if (!open) return null;

  const received = Number(receivedAmount) || 0;
  const change =
    paymentMethod === "CASH" ? calculatePosChange(received, total) : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_rgba(15,31,77,0.2)] sm:rounded-[24px]">
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

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-bold text-[#24345f]">Ödeme tipi</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                const active = paymentMethod === method.value;

                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => onPaymentMethodChange(method.value)}
                    className={[
                      "flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-bold transition",
                      active
                        ? "border-[#0f1f4d] bg-[#0f1f4d] text-white"
                        : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <Icon size={18} />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === "CASH" ? (
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
            disabled={checkingOut}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] hover:bg-[#162a5c] disabled:opacity-50"
          >
            {checkingOut ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Onaylanıyor...
              </>
            ) : (
              "Satışı Onayla"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
