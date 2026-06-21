"use client";

import { PRODUCT_STATS_BAR_CLASS } from "@/components/products/product-ui-tokens";
import { WarehouseStatPill } from "@/components/warehouses/warehouses-shared";
import { formatStockMoney, formatStockNumber } from "@/lib/stocks-page-utils";

export type WarehousesSummaryStats = {
  totalWarehouses: number;
  activeWarehouses: number;
  passiveWarehouses: number;
  defaultWarehouseName: string;
  totalStock: number;
  totalStockValue: number;
  lowStockCount: number;
  lastTransferAt: string | null;
  lastTransferNo: string | null;
};

export function WarehousesSummaryBar({ stats }: { stats: WarehousesSummaryStats }) {
  const lastTransferLabel = stats.lastTransferAt
    ? new Date(stats.lastTransferAt).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
      })
    : "—";

  return (
    <section
      className={`${PRODUCT_STATS_BAR_CLASS} flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      <WarehouseStatPill label="Toplam Depo" value={String(stats.totalWarehouses)} />
      <WarehouseStatPill
        label="Aktif Depo"
        value={String(stats.activeWarehouses)}
        tone="emerald"
      />
      <WarehouseStatPill
        label="Toplam Stok"
        value={formatStockNumber(stats.totalStock)}
      />
      <WarehouseStatPill
        label="Stok Değeri"
        value={formatStockMoney(stats.totalStockValue)}
        tone="blue"
      />
      <WarehouseStatPill
        label="Düşük Stok"
        value={String(stats.lowStockCount)}
        tone={stats.lowStockCount > 0 ? "amber" : "slate"}
      />
      <WarehouseStatPill
        label="Son Transfer"
        value={stats.lastTransferNo ? `${stats.lastTransferNo} · ${lastTransferLabel}` : "—"}
        tone="slate"
      />
    </section>
  );
}
