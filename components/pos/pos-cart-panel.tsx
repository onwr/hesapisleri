"use client";

import type { ReactNode } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Landmark,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { PosPaymentMethod, PosPaymentStatus } from "@/lib/pos-checkout-utils";

export type PosCartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
};

type AccountOption = {
  id: string;
  name: string;
  type: string;
};

type PosCartPanelProps = {
  cart: PosCartItem[];
  subtotal: number;
  vatTotal: number;
  discount: string;
  total: number;
  note: string;
  error: string;
  checkingOut: boolean;
  paymentMethod: PosPaymentMethod;
  paymentStatus: PosPaymentStatus;
  collectedAmount: string;
  selectedAccountId: string;
  accounts: AccountOption[];
  onDiscountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  onPaymentMethodChange: (method: PosPaymentMethod) => void;
  onPaymentStatusChange: (status: PosPaymentStatus) => void;
  onCollectedAmountChange: (value: string) => void;
  onAccountChange: (accountId: string) => void;
  formatMoney: (value: number) => string;
  mobile?: boolean;
  onCloseMobile?: () => void;
};

const paidMethods: Array<{
  label: string;
  value: PosPaymentMethod;
  icon: ReactNode;
}> = [
  { label: "Nakit", value: "CASH", icon: <Banknote size={18} /> },
  { label: "Kart", value: "CARD", icon: <CreditCard size={18} /> },
  { label: "Havale", value: "BANK_TRANSFER", icon: <Wallet size={18} /> },
];

function getCheckoutLabel(
  paymentStatus: PosPaymentStatus,
  paymentMethod: PosPaymentMethod
) {
  if (paymentStatus === "UNPAID") return "Veresiye Satışı Tamamla";
  if (paymentStatus === "PARTIAL") return "Kısmi Ödeme ile Tamamla";

  if (paymentMethod === "CASH") return "Nakit ile Satışı Tamamla";
  if (paymentMethod === "CARD") return "Kart ile Satışı Tamamla";
  return "Havale ile Satışı Tamamla";
}

export function PosCartPanel({
  cart,
  subtotal,
  vatTotal,
  discount,
  total,
  note,
  error,
  checkingOut,
  paymentMethod,
  paymentStatus,
  collectedAmount,
  selectedAccountId,
  accounts,
  onDiscountChange,
  onNoteChange,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onCheckout,
  onPaymentMethodChange,
  onPaymentStatusChange,
  onCollectedAmountChange,
  onAccountChange,
  formatMoney,
  mobile = false,
  onCloseMobile,
}: PosCartPanelProps) {
  const showAccountSelect =
    paymentStatus === "PAID" || paymentStatus === "PARTIAL";

  const filteredAccounts = accounts.filter((account) => {
    if (paymentMethod === "BANK_TRANSFER") {
      return account.type === "BANK";
    }

    return account.type === "CASH";
  });

  return (
    <div
      className={[
        "rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-100/40",
        mobile ? "h-full overflow-y-auto p-5" : "sticky top-6 p-6",
      ].join(" ")}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">Sepet</h2>
          <p className="text-sm text-slate-500">
            {cart.length} kalem · {formatMoney(total)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mobile && onCloseMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500"
            >
              <X size={18} />
            </button>
          ) : null}

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShoppingCart size={23} />
          </div>
        </div>
      </div>

      <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {cart.map((item) => (
          <div
            key={item.productId}
            className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatMoney(item.unitPrice)} · KDV %{item.vatRate}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.productId)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 hover:bg-red-50"
              >
                <Trash2 size={17} />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full bg-white p-1">
                <button
                  type="button"
                  onClick={() => onDecrease(item.productId)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                >
                  <Minus size={15} />
                </button>

                <span className="min-w-8 text-center text-sm font-black text-slate-950">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onClick={() => onIncrease(item.productId)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white"
                >
                  <Plus size={15} />
                </button>
              </div>

              <p className="font-black text-slate-950">
                {formatMoney(item.quantity * item.unitPrice)}
              </p>
            </div>
          </div>
        ))}

        {cart.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <ShoppingCart size={24} />
            </div>
            <p className="mt-4 font-black text-slate-950">Sepet boş</p>
            <p className="mt-2 text-sm text-slate-500">
              Ürün seçerek veya barkod okutarak satışa başlayın.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 rounded-3xl bg-slate-50 p-5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Ara Toplam</span>
          <span className="font-bold text-slate-800">{formatMoney(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">KDV</span>
          <span className="font-bold text-slate-800">{formatMoney(vatTotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">İndirim (₺)</span>
          <input
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            type="number"
            min="0"
            className="h-11 w-32 rounded-2xl border border-slate-200 bg-white px-3 text-right text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <div className="h-px bg-slate-200" />

        <div className="flex justify-between">
          <span className="font-black text-slate-950">Genel Toplam</span>
          <span className="text-2xl font-black text-slate-950">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-slate-700">Ödeme Tipi</p>

        <div className="grid grid-cols-3 gap-2">
          {paidMethods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                onPaymentStatusChange("PAID");
                onPaymentMethodChange(item.value);
              }}
              className={[
                "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-black transition",
                paymentStatus === "PAID" && paymentMethod === item.value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPaymentStatusChange("UNPAID")}
            className={[
              "flex h-14 items-center justify-center gap-2 rounded-2xl text-xs font-black transition",
              paymentStatus === "UNPAID"
                ? "bg-amber-600 text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
            ].join(" ")}
          >
            <HandCoins size={18} />
            Veresiye
          </button>

          <button
            type="button"
            onClick={() => onPaymentStatusChange("PARTIAL")}
            className={[
              "flex h-14 items-center justify-center gap-2 rounded-2xl text-xs font-black transition",
              paymentStatus === "PARTIAL"
                ? "bg-violet-600 text-white"
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
            ].join(" ")}
          >
            <Landmark size={18} />
            Kısmi Ödeme
          </button>
        </div>
      </div>

      {paymentStatus === "PARTIAL" ? (
        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Tahsil Edilen Tutar
          </label>
          <input
            value={collectedAmount}
            onChange={(e) => onCollectedAmountChange(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            placeholder="0,00"
          />
        </div>
      ) : null}

      {showAccountSelect ? (
        <div className="mt-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Tahsilat Hesabı
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Otomatik (Nakit Kasa / Banka)</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Hesap seçilmezse uygun kasa otomatik oluşturulur.
          </p>
        </div>
      ) : null}

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        className="mt-4 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        placeholder="Satış notu..."
      />

      {error ? (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        <button
          type="button"
          onClick={onCheckout}
          disabled={checkingOut || cart.length === 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-green-500 to-emerald-600 text-sm font-black text-white shadow-lg shadow-green-100 transition hover:opacity-95 disabled:opacity-50"
        >
          {checkingOut ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          {checkingOut
            ? "Satış tamamlanıyor..."
            : getCheckoutLabel(paymentStatus, paymentMethod)}
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={checkingOut || cart.length === 0}
          className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Sepeti Temizle
        </button>
      </div>
    </div>
  );
}
