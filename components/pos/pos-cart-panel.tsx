"use client";

import {
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { POS_CARD_CLASS, POS_CART_ROW_CLASS } from "@/components/pos/pos-ui-tokens";

export type PosCartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
};

type PosCartPanelProps = {
  cart: PosCartItem[];
  subtotal: number;
  vatTotal: number;
  discount: string;
  total: number;
  error: string;
  checkingOut: boolean;
  onDiscountChange: (value: string) => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onOpenPayment: () => void;
  formatMoney: (value: number) => string;
  mobile?: boolean;
  onCloseMobile?: () => void;
};

export function PosCartPanel({
  cart,
  subtotal,
  vatTotal,
  discount,
  total,
  error,
  checkingOut,
  onDiscountChange,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
  onOpenPayment,
  formatMoney,
  mobile = false,
  onCloseMobile,
}: PosCartPanelProps) {
  return (
    <div
      className={[
        POS_CARD_CLASS,
        mobile ? "h-full overflow-y-auto p-5" : "sticky top-4 p-5 xl:p-6",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0f1f4d]">Sepet</h2>
            <p className="text-xs text-slate-500">{cart.length} ürün</p>
          </div>
        </div>

        {mobile && onCloseMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <ShoppingCart size={22} />
            </div>
            <p className="mt-3 text-sm font-extrabold text-[#0f1f4d]">
              Sepet boş
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Satışa başlamak için ürün ekleyin.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.productId} className={POS_CART_ROW_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-[#0f1f4d]">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Birim: {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.productId)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => onDecrease(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-8 text-center text-sm font-extrabold text-[#0f1f4d]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrease(item.productId)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f1f4d] text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-sm font-extrabold text-[#0f1f4d]">
                  {formatMoney(item.quantity * item.unitPrice)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Ara toplam</span>
          <span className="font-bold text-[#0f1f4d]">
            {formatMoney(subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">İndirim (₺)</span>
          <input
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            type="number"
            min="0"
            className="h-10 w-28 rounded-xl border border-slate-200/80 bg-white px-3 text-right text-sm font-bold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">KDV</span>
          <span className="font-bold text-[#0f1f4d]">{formatMoney(vatTotal)}</span>
        </div>
        <div className="h-px bg-slate-200" />
        <div className="flex justify-between">
          <span className="font-extrabold text-[#0f1f4d]">Genel toplam</span>
          <span className="text-xl font-extrabold text-[#0f1f4d]">
            {formatMoney(total)}
          </span>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onOpenPayment}
          disabled={checkingOut || cart.length === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] text-sm font-black text-white shadow-[0_10px_24px_rgba(15,31,77,0.18)] transition hover:bg-[#162a5c] disabled:opacity-50"
        >
          {checkingOut ? (
            <Loader2 className="animate-spin" size={18} />
          ) : null}
          Satışı Tamamla
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={checkingOut || cart.length === 0}
          className="flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Sepeti Temizle
        </button>
      </div>
    </div>
  );
}
