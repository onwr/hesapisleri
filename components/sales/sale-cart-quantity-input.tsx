"use client";

import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  formatSaleCartQuantityInput,
  resolveSaleCartQuantityCommit,
  type SaleCartQuantityItem,
} from "@/lib/sale-cart-quantity-utils";

type SaleCartQuantityInputProps = {
  productId: string;
  productName: string;
  quantity: number;
  item: SaleCartQuantityItem;
  allowNegativeStock?: boolean;
  disabled?: boolean;
  compact?: boolean;
  error?: string | null;
  onQuantityChange: (productId: string, quantity: number) => void;
  onQuantityRemove: (productId: string) => void;
  onQuantityError?: (productId: string, error: string | null) => void;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
};

export function SaleCartQuantityInput({
  productId,
  productName,
  quantity,
  item,
  allowNegativeStock = false,
  disabled = false,
  compact = false,
  error = null,
  onQuantityChange,
  onQuantityRemove,
  onQuantityError,
  onIncrease,
  onDecrease,
}: SaleCartQuantityInputProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(formatSaleCartQuantityInput(quantity));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatSaleCartQuantityInput(quantity));
    }
  }, [focused, quantity]);

  function commitDraft(raw = draft) {
    const result = resolveSaleCartQuantityCommit({
      raw,
      currentQuantity: quantity,
      item,
      allowNegativeStock,
    });

    if (result.error) {
      onQuantityError?.(productId, result.error);
      setDraft(formatSaleCartQuantityInput(quantity));
      return;
    }

    onQuantityError?.(productId, null);

    if (result.remove) {
      onQuantityRemove(productId);
      return;
    }

    if (result.quantity !== null && result.quantity !== quantity) {
      onQuantityChange(productId, result.quantity);
      return;
    }

    setDraft(formatSaleCartQuantityInput(quantity));
  }

  const buttonSize = compact ? "h-8 w-8" : "h-8 w-8";
  const inputClass = compact
    ? "h-8 min-w-[2.75rem] w-12 rounded-xl border-0 bg-transparent px-1 text-center text-sm font-extrabold text-[#0f1f4d] outline-none focus:ring-2 focus:ring-blue-100"
    : "h-8 min-w-[2.75rem] w-12 rounded-xl border-0 bg-transparent px-1 text-center text-[12px] font-black text-[#0f1f4d] outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={[
          "flex items-center gap-1 rounded-2xl border bg-white p-1",
          error
            ? "border-rose-300 ring-1 ring-rose-100"
            : "border-slate-200/80",
          compact ? "" : "rounded-xl",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onDecrease(productId)}
          disabled={disabled}
          aria-label={`${productName} miktarını azalt`}
          className={[
            "flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50",
            buttonSize,
            compact ? "" : "rounded-lg h-7 w-7",
          ].join(" ")}
        >
          <Minus size={14} />
        </button>

        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={disabled}
          aria-label={`${productName} miktarı`}
          aria-invalid={error ? true : undefined}
          className={inputClass}
          onFocus={(event) => {
            setFocused(true);
            event.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            commitDraft();
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) {
              onQuantityError?.(productId, null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          onWheel={(event) => {
            event.currentTarget.blur();
          }}
        />

        <button
          type="button"
          onClick={() => onIncrease(productId)}
          disabled={disabled}
          aria-label={`${productName} miktarını artır`}
          className={[
            "flex items-center justify-center rounded-xl text-white disabled:opacity-50",
            buttonSize,
            compact ? "bg-[#0f1f4d]" : "rounded-lg h-7 w-7 bg-blue-600",
          ].join(" ")}
        >
          <Plus size={14} />
        </button>
      </div>

      {error ? (
        <p className="max-w-[220px] text-[10px] font-semibold leading-snug text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
