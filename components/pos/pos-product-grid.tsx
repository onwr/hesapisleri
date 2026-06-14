"use client";

import { Plus, ShoppingBag } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { POS_PRODUCT_CARD_CLASS } from "@/components/pos/pos-ui-tokens";
import {
  getPosProductStock,
  isPosProductLowStock,
  isPosProductOutOfStock,
  type PosGridProduct,
} from "@/lib/pos-page-utils";

type PosProductGridProps = {
  products: PosGridProduct[];
  onAdd: (product: PosGridProduct) => void;
  formatMoney: (value: number) => string;
  showWarehouseStock?: boolean;
};

export function PosProductGrid({
  products,
  onAdd,
  formatMoney,
  showWarehouseStock = false,
}: PosProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
          <ShoppingBag size={24} />
        </div>
        <p className="mt-4 text-sm font-extrabold text-[#0f1f4d]">
          Ürün bulunamadı
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Arama, barkod veya kategori filtrelerini değiştirin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const displayStock = getPosProductStock(product, showWarehouseStock);
        const outOfStock = isPosProductOutOfStock(product, showWarehouseStock);
        const lowStock = isPosProductLowStock(product, showWarehouseStock);

        return (
          <article
            key={product.id}
            className={[
              POS_PRODUCT_CARD_CLASS,
              outOfStock ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <ProductThumbnail
                imageUrl={product.imageUrl}
                alt={product.name}
                size={52}
                iconSize={22}
                rounded="2xl"
                dimmed={outOfStock}
                className="border border-slate-200/70 bg-blue-50/50"
              />

              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[10px] font-black",
                  outOfStock
                    ? "bg-slate-100 text-slate-500"
                    : lowStock
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {outOfStock ? "Stok yok" : `${displayStock} stok`}
              </span>
            </div>

            <p className="line-clamp-2 font-extrabold text-[#0f1f4d]">
              {product.name}
            </p>

            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {[product.sku, product.barcode].filter(Boolean).join(" · ") ||
                product.category?.name ||
                "Genel"}
            </p>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold text-[#0f1f4d]">
                  {formatMoney(Number(product.sellPrice))}
                </p>
                <p className="text-[11px] text-slate-400">
                  KDV %{product.vatRate}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onAdd(product)}
                disabled={outOfStock}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#0f1f4d] px-3 text-xs font-black text-white transition hover:bg-[#162a5c] disabled:bg-slate-200 disabled:text-slate-500"
              >
                <Plus size={14} />
                Sepete Ekle
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export type { PosGridProduct };
