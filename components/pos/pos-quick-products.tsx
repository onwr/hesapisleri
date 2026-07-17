"use client";

import { AlertTriangle, Zap } from "lucide-react";
import { getPosStockBadge } from "@/lib/pos-page-utils";
import { POS_CARD_CLASS } from "@/components/pos/pos-ui-tokens";
import type { PosQuickProductStat } from "@/lib/pos-stats-service";

type PosQuickProductsProps = {
  products: PosQuickProductStat[];
  onAdd: (productId: string) => void;
  formatMoney: (value: number) => string;
  allowNegativeStock?: boolean;
};

export function PosQuickProducts({
  products,
  onAdd,
  formatMoney,
  allowNegativeStock = false,
}: PosQuickProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Zap size={14} className="text-amber-500" />
        <h3 className="text-[12px] font-black uppercase tracking-wide text-[#0f1f4d]">
          Hızlı Ürünler
        </h3>
        <span className="text-[11px] font-semibold text-slate-400">
          En çok satılanlar
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {products.map((product) => {
          const isService = product.productType === "SERVICE";
          const outOfStock = !isService && product.stock <= 0 && !allowNegativeStock;
          const lowStock = !isService && product.stock > 0 && product.stock <= 10;
          const badge = getPosStockBadge(product.stock, product.productType);

          return (
            <button
              key={product.productId}
              type="button"
              disabled={outOfStock}
              onClick={() => onAdd(product.productId)}
              className={[
                POS_CARD_CLASS,
                "min-w-[148px] max-w-[180px] shrink-0 p-3 text-left transition",
                outOfStock
                  ? "cursor-not-allowed opacity-55"
                  : "hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]",
              ].join(" ")}
            >
              <p className="line-clamp-2 text-[13px] font-extrabold text-[#0f1f4d]">
                {product.name}
              </p>
              <p className="mt-2 text-[15px] font-black text-emerald-700">
                {formatMoney(product.sellPrice)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    badge.className,
                  ].join(" ")}
                >
                  {badge.label}
                </span>
                {lowStock ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                    <AlertTriangle size={10} />
                    Az
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
