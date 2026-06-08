"use client";

import { ShoppingCart } from "lucide-react";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import {
  calculateProductProfit,
  formatProfitMargin,
  getStockStatusLabel,
  PRODUCT_UNIT_LABELS,
  type ProductFormValues,
} from "@/lib/product-form-utils";
import {
  formatProductMoney,
  getCategoryBadge,
  getProductStatusBadge,
} from "@/lib/products-page-utils";

type ProductPreviewPanelProps = {
  form: ProductFormValues;
};

export function ProductPreviewPanel({ form }: ProductPreviewPanelProps) {
  const buyPrice = Number(form.buyPrice || 0);
  const sellPrice = Number(form.sellPrice || 0);
  const stock = Number(form.stock || 0);
  const minStock = Number(form.minStock || 10);
  const { profit, margin } = calculateProductProfit(buyPrice, sellPrice);
  const stockStatus = getStockStatusLabel(stock, minStock);
  const statusBadge = getProductStatusBadge(form.status);
  const categoryName = form.categoryName.trim() || "Genel";

  return (
    <div className="space-y-5 xl:sticky xl:top-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-linear-to-br from-rose-500 to-pink-600 p-5 text-white">
          <div className="mb-4 flex items-start gap-4">
            <ProductThumbnail
              imageUrl={form.imageUrl}
              alt={form.name.trim() || "Ürün görseli"}
              size={72}
              iconSize={28}
              rounded="2xl"
              className="border border-white/20 bg-white/10"
            />

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/80">
                Ürün Önizleme
              </p>
              <h3 className="mt-2 text-[22px] font-black leading-tight">
                {form.name.trim() || "Yeni Ürün"}
              </h3>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={[
                "rounded-md px-2 py-1 text-[10px] font-black",
                getCategoryBadge(categoryName),
              ].join(" ")}
            >
              {categoryName}
            </span>
            <span
              className={[
                "rounded-md px-2 py-1 text-[10px] font-black",
                statusBadge.className,
              ].join(" ")}
            >
              {statusBadge.label}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <PreviewLine label="Satış Fiyatı" value={formatProductMoney(sellPrice)} />
          <PreviewLine label="Alış Fiyatı" value={formatProductMoney(buyPrice)} />
          <PreviewLine
            label="Tahmini Kâr"
            value={formatProductMoney(profit)}
            valueClass={profit >= 0 ? "text-emerald-600" : "text-rose-600"}
          />
          <PreviewLine label="Kâr Marjı" value={formatProfitMargin(margin)} />
          <PreviewLine
            label="Stok Durumu"
            value={`${stock} ${PRODUCT_UNIT_LABELS[form.unitType]}`}
          />
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span
              className={[
                "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black",
                stockStatus.className,
              ].join(" ")}
            >
              {stockStatus.label}
            </span>
            <p className="mt-2 text-[11px] font-medium text-slate-500">
              Kritik seviye: {minStock} {PRODUCT_UNIT_LABELS[form.unitType]}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-black text-[#0f1f4d]">
          <ShoppingCart size={16} />
          POS Örnek Kart
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <ProductThumbnail
              imageUrl={form.imageUrl}
              alt={form.name.trim() || "POS önizleme"}
              size={48}
              iconSize={22}
              rounded="2xl"
              className="border border-slate-200 bg-white shadow-sm"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-black text-[#0f1f4d]">
                {form.name.trim() || "Ürün adı"}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {form.barcode || form.sku || "Barkod / SKU yok"}
              </p>
              <p className="mt-3 text-[18px] font-black text-emerald-600">
                {formatProductMoney(sellPrice)}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">
                Stok: {stock} • KDV %{form.vatRate}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewLine({
  label,
  value,
  valueClass = "text-[#0f1f4d]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3">
      <span className="text-[12px] font-medium text-slate-500">{label}</span>
      <span className={["text-[13px] font-black", valueClass].join(" ")}>
        {value}
      </span>
    </div>
  );
}
