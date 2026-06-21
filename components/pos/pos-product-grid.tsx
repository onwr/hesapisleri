"use client";

import { Plus, ShoppingBag, Sparkles } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { POS_PRODUCT_CARD_CLASS } from "@/components/pos/pos-ui-tokens";
import {
  getPosProductStock,
  getPosStockBadge,
  type PosGridProduct,
} from "@/lib/pos-page-utils";

type PosProductGridProps = {
  products: PosGridProduct[];
  onAdd: (product: PosGridProduct) => void;
  formatMoney: (value: number) => string;
  showWarehouseStock?: boolean;
};

function getProductCardAccent(productType?: "STOCK" | "SERVICE") {
  if (productType === "SERVICE") {
    return {
      topBar: "bg-linear-to-r from-cyan-500 to-blue-500",
      addButton:
        "bg-linear-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600",
      typeBadge: "bg-cyan-50 text-cyan-700",
      typeLabel: "Hizmet",
    };
  }

  return {
    topBar: "bg-linear-to-r from-emerald-500 to-teal-500",
    addButton:
      "bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
    typeBadge: "bg-emerald-50 text-emerald-700",
    typeLabel: "Ürün",
  };
}

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
        const stockBadge = getPosStockBadge(displayStock, product.productType);
        const accent = getProductCardAccent(product.productType);

        return (
          <article key={product.id} className={POS_PRODUCT_CARD_CLASS}>
            <div className={["absolute inset-x-0 top-0 h-1", accent.topBar].join(" ")} />

            <div className="mb-3 flex items-start justify-between gap-3 pt-1">
              <ProductThumbnail
                imageUrl={product.imageUrl}
                alt={product.name}
                size={52}
                iconSize={22}
                rounded="2xl"
                className="border border-slate-200/70 bg-blue-50/50"
              />

              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={[
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
                    accent.typeBadge,
                  ].join(" ")}
                >
                  {product.productType === "SERVICE" ? (
                    <Sparkles size={10} />
                  ) : null}
                  {accent.typeLabel}
                </span>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[10px] font-black",
                    stockBadge.className,
                  ].join(" ")}
                >
                  {stockBadge.label}
                </span>
              </div>
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
                className={[
                  "inline-flex h-10 items-center gap-1.5 rounded-2xl px-3 text-xs font-black text-white transition",
                  accent.addButton,
                ].join(" ")}
              >
                <Plus size={14} />
                Ekle
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export type { PosGridProduct };
