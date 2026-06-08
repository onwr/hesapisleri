"use client";

import { Plus } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";

export type PosGridProduct = {
  id: string;
  name: string;
  stock: number;
  warehouseStock?: number;
  sellPrice: string | number;
  vatRate: number;
  imageUrl?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
};

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
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <p className="text-lg font-black text-slate-950">Ürün bulunamadı</p>
        <p className="mt-2 text-sm text-slate-500">
          Barkod, SKU, ürün adı veya kategori ile arama yapabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => {
        const displayStock =
          showWarehouseStock && product.warehouseStock !== undefined
            ? product.warehouseStock
            : product.stock;
        const outOfStock = displayStock <= 0;
        const lowStock = displayStock > 0 && displayStock <= 10;

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onAdd(product)}
            disabled={outOfStock}
            className={[
              "group rounded-3xl border p-4 text-left transition",
              outOfStock
                ? "cursor-not-allowed border-red-100 bg-red-50/80 opacity-60"
                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60",
            ].join(" ")}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <ProductThumbnail
                imageUrl={product.imageUrl}
                alt={product.name}
                size={48}
                iconSize={22}
                rounded="2xl"
                dimmed={outOfStock}
                className="border border-slate-200 bg-linear-to-br from-blue-50 to-violet-50"
              />

              <span
                className={[
                  "rounded-full px-2.5 py-1 text-xs font-black",
                  outOfStock
                    ? "bg-red-100 text-red-700"
                    : lowStock
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700",
                ].join(" ")}
              >
                {outOfStock ? "Stok yok" : `${displayStock} stok`}
              </span>
            </div>

            <p className="font-black text-slate-950 group-hover:text-blue-600">
              {product.name}
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              {product.category?.name ?? "Genel"}
            </p>

            {showWarehouseStock ? (
              <p className="mt-1 text-[11px] font-bold text-blue-600">
                Bu depoda: {displayStock} adet
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-lg font-black text-slate-950">
                {formatMoney(Number(product.sellPrice))}
              </p>

              {!outOfStock ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Plus size={18} />
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
