"use client";

import type { ReactNode } from "react";
import { ProductsStockSyncButton } from "@/components/products/products-stock-sync-button";
import { ProductsSubNav } from "@/components/products/products-sub-nav";
import { WarehousesQuickActions } from "@/components/warehouses/warehouses-quick-actions";
import { WarehousesSummaryCards } from "@/components/warehouses/warehouses-summary-cards";
import {
  buildWarehouseQuickActionCards,
  buildWarehouseSummaryCards,
  type WarehousePageStats,
  type WarehouseQuickActionKey,
} from "@/lib/warehouses-page-ui-utils";

type WarehousesShellProps = {
  stats: WarehousePageStats;
  canManage: boolean;
  canSyncStock?: boolean;
  onQuickAction: (key: WarehouseQuickActionKey) => void;
  children: ReactNode;
};

export function WarehousesShell({
  stats,
  canManage,
  canSyncStock = false,
  onQuickAction,
  children,
}: WarehousesShellProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Depolar
          </h1>
          <p className="text-[12px] font-medium text-slate-500">
            Depolarınızı, stok durumlarını ve transfer işlemlerini yönetin.
          </p>
        </div>

        {canSyncStock ? (
          <div className="flex shrink-0 items-center">
            <ProductsStockSyncButton canSync={canSyncStock} compact />
          </div>
        ) : null}
      </div>

      <WarehousesQuickActions
        cards={buildWarehouseQuickActionCards()}
        canManage={canManage}
        onAction={onQuickAction}
      />

      <WarehousesSummaryCards cards={buildWarehouseSummaryCards(stats)} />
      <ProductsSubNav />

      {children}
    </div>
  );
}
