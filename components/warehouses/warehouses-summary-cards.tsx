"use client";

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Package,
  Warehouse,
} from "lucide-react";
import type { WarehouseSummaryCard } from "@/lib/warehouses-page-ui-utils";

const iconMap = {
  warehouse: Warehouse,
  active: Package,
  products: Package,
  stock: Boxes,
  value: CircleDollarSign,
  alert: AlertTriangle,
} as const;

const colorClassMap = {
  slate: "bg-slate-50 text-slate-600",
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-500",
} as const;

type WarehousesSummaryCardsProps = {
  cards: WarehouseSummaryCard[];
};

export function WarehousesSummaryCards({ cards }: WarehousesSummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = iconMap[card.iconKey];

        return (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.04)]"
            title={
              card.key === "stock-value"
                ? "Stok değeri alış fiyatına göre hesaplanır."
                : undefined
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-[#24345f]/80">
                  {card.title}
                </p>
                <p className="mt-2 text-[18px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                  {card.value}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">
                  {card.subtitle}
                </p>
              </div>
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  colorClassMap[card.color],
                ].join(" ")}
              >
                <Icon size={18} strokeWidth={2.4} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
