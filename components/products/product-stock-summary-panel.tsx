"use client";

import { AlertTriangle, Package, TrendingUp } from "lucide-react";
import { getStockStatusLabel } from "@/lib/product-form-utils";
import {
  calculateStockMovement,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockMovementRequestType,
} from "@/lib/stock-movement-utils";

type ProductStockSummaryPanelProps = {
  product: {
    name: string;
    stock: number;
    minStock: number;
    unitLabel: string;
    categoryName: string;
  };
  movementType: StockMovementRequestType;
  quantityInput: string;
};

export function ProductStockSummaryPanel({
  product,
  movementType,
  quantityInput,
}: ProductStockSummaryPanelProps) {
  const parsedQuantity = Number(quantityInput);
  const hasQuantity =
    quantityInput.trim() !== "" && !Number.isNaN(parsedQuantity);

  const calculation = hasQuantity
    ? calculateStockMovement(movementType, product.stock, parsedQuantity)
    : null;

  const projectedStock =
    calculation && !("error" in calculation)
      ? calculation.newStock
      : product.stock;

  const currentStatus = getStockStatusLabel(product.stock, product.minStock);
  const projectedStatus = getStockStatusLabel(projectedStock, product.minStock);
  const stockError =
    calculation && "error" in calculation ? calculation.error : "";

  return (
    <div className="space-y-5 xl:sticky xl:top-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-linear-to-br from-orange-500 to-amber-600 p-5 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white/80">
            Ürün Özeti
          </p>
          <h3 className="mt-2 text-[22px] font-black leading-tight">
            {product.name}
          </h3>
          <p className="mt-1 text-[12px] font-medium text-white/80">
            {product.categoryName}
          </p>
        </div>

        <div className="space-y-4 p-4">
          <SummaryBlock
            label="Mevcut stok"
            value={`${product.stock} ${product.unitLabel}`}
            badge={currentStatus}
          />

          <SummaryBlock
            label="Kritik stok seviyesi"
            value={`${product.minStock} ${product.unitLabel}`}
          />

          <SummaryBlock
            label="Yeni tahmini stok"
            value={`${projectedStock} ${product.unitLabel}`}
            badge={hasQuantity ? projectedStatus : undefined}
            highlight
          />

          {hasQuantity && calculation && !("error" in calculation) ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <TrendingUp size={17} />
                </div>
                <div>
                  <p className="text-[12px] font-black text-[#0f1f4d]">
                    {STOCK_MOVEMENT_TYPE_LABELS[movementType]} önizlemesi
                  </p>
                  <p className="mt-1 text-[11px] font-medium leading-5 text-blue-700">
                    {movementType === "COUNT"
                      ? `Sayım farkı: ${calculation.movementQuantity >= 0 ? "+" : ""}${calculation.movementQuantity} ${product.unitLabel}`
                      : movementType === "ADJUSTMENT"
                        ? `Düzeltme: ${calculation.movementQuantity >= 0 ? "+" : ""}${calculation.movementQuantity} ${product.unitLabel}`
                        : movementType === "IN"
                          ? `+${calculation.movementQuantity} ${product.unitLabel} eklenecek`
                          : `-${calculation.movementQuantity} ${product.unitLabel} düşülecek`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {stockError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-[12px] font-bold text-rose-700">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {stockError}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
            <Package size={18} />
          </div>
          <div>
            <p className="text-[13px] font-black text-[#0f1f4d]">
              Stok hareketi kuralı
            </p>
            <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
              Stok değişiklikleri yalnızca hareket kaydı ile yapılır. Düzenleme
              sayfasından stok miktarı değiştirilemez.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryBlock({
  label,
  value,
  badge,
  highlight = false,
}: {
  label: string;
  value: string;
  badge?: { label: string; className: string };
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        highlight
          ? "border-orange-100 bg-orange-50/60"
          : "border-slate-100 bg-slate-50/70",
      ].join(" ")}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-[18px] font-black text-[#0f1f4d]">{value}</p>
        {badge ? (
          <span
            className={[
              "rounded-md px-2 py-1 text-[10px] font-black",
              badge.className,
            ].join(" ")}
          >
            {badge.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
