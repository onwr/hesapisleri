"use client";

import {
  Loader2,
  Percent,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import {
  POS_CARD_CLASS,
  POS_CART_ROW_CLASS,
  POS_GRADIENT_CHECKOUT_CLASS,
  POS_GRADIENT_TOTAL_CLASS,
} from "@/components/pos/pos-ui-tokens";
import { SaleLineEditFields } from "@/components/sales/sale-line-edit-fields";
import { SaleCartQuantityInput } from "@/components/sales/sale-cart-quantity-input";
import { calculateLineSubtotal } from "@/lib/sale-calculation-utils";

export type PosCartItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  stock: number;
  productType?: "STOCK" | "SERVICE";
};

type PosCartPanelProps = {
  cart: PosCartItem[];
  subtotal: number;
  vatTotal: number;
  discount: string;
  discountAmount: number;
  total: number;
  error: string;
  checkingOut: boolean;
  onDiscountChange: (value: string) => void;
  onUnitPriceChange: (productId: string, value: number) => void;
  onVatRateChange: (productId: string, value: number) => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
  onQuantityRemove: (productId: string) => void;
  onQuantityError?: (productId: string, error: string | null) => void;
  quantityErrors?: Record<string, string>;
  allowNegativeStock?: boolean;
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
  discountAmount,
  total,
  error,
  checkingOut,
  onDiscountChange,
  onUnitPriceChange,
  onVatRateChange,
  onIncrease,
  onDecrease,
  onQuantityChange,
  onQuantityRemove,
  onQuantityError,
  quantityErrors = {},
  allowNegativeStock = false,
  onRemove,
  onClear,
  onOpenPayment,
  formatMoney,
  mobile = false,
  onCloseMobile,
}: PosCartPanelProps) {
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className={[
        POS_CARD_CLASS,
        mobile ? "h-full overflow-y-auto p-5" : "sticky top-4 p-5 xl:p-6",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[#0f1f4d]">Sepet</h2>
            <p className="text-xs text-slate-500">
              {cart.length} kalem · {cartItemCount} adet
            </p>
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
                  <p className="mt-1 text-[10px] font-medium text-slate-400">
                    Bu satışa özel fiyat
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.productId)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3">
                <SaleLineEditFields
                  key={item.productId}
                  unitPrice={item.unitPrice}
                  vatRate={item.vatRate}
                  onUnitPriceChange={(value) =>
                    onUnitPriceChange(item.productId, value)
                  }
                  onVatRateChange={(value) =>
                    onVatRateChange(item.productId, value)
                  }
                  compact
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <SaleCartQuantityInput
                  productId={item.productId}
                  productName={item.name}
                  quantity={item.quantity}
                  item={item}
                  allowNegativeStock={allowNegativeStock}
                  disabled={checkingOut}
                  compact
                  error={quantityErrors[item.productId] ?? null}
                  onQuantityChange={onQuantityChange}
                  onQuantityRemove={onQuantityRemove}
                  onQuantityError={onQuantityError}
                  onIncrease={onIncrease}
                  onDecrease={onDecrease}
                />
                <p className="text-sm font-extrabold text-[#0f1f4d]">
                  {formatMoney(calculateLineSubtotal(item))}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-bold text-rose-700">
            <Percent size={14} />
            İndirim (₺)
          </span>
          <input
            id="pos-discount-input"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            type="number"
            min="0"
            className="h-10 w-28 rounded-xl border border-rose-200 bg-white px-3 text-right text-sm font-bold text-[#0f1f4d] outline-none focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Ara Toplam</span>
          <span className="font-bold text-[#0f1f4d]">
            {formatMoney(subtotal)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">KDV</span>
          <span className="font-bold text-[#0f1f4d]">{formatMoney(vatTotal)}</span>
        </div>
        {discountAmount > 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-rose-600">İndirim</span>
            <span className="font-bold text-rose-600">
              -{formatMoney(discountAmount)}
            </span>
          </div>
        ) : null}
        <div className="h-px bg-slate-200" />
        <div className={POS_GRADIENT_TOTAL_CLASS}>
          <div className="flex justify-between">
            <span className="font-extrabold text-[#0f1f4d]">Genel Toplam</span>
            <span className="text-xl font-extrabold text-[#0f1f4d]">
              {formatMoney(total)}
            </span>
          </div>
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
          className={[
            "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-black text-white transition disabled:opacity-50",
            POS_GRADIENT_CHECKOUT_CLASS,
          ].join(" ")}
        >
          {checkingOut ? (
            <Loader2 className="animate-spin" size={18} />
          ) : null}
          Satışı Tamamla
        </button>
        <p className="hidden text-center text-[10px] font-semibold text-slate-400 xl:block">
          Nakit <kbd className="rounded border px-1">F2</kbd> · Kart{" "}
          <kbd className="rounded border px-1">F4</kbd> · Barkod{" "}
          <kbd className="rounded border px-1">F6</kbd>
        </p>
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
