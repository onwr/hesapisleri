"use client";

import { ProductsQuickActions } from "@/components/products/products-quick-actions";
import { ProductsStockSyncButton } from "@/components/products/products-stock-sync-button";
import { ProductsSubNav } from "@/components/products/products-sub-nav";
import { ProductsSummaryCards } from "@/components/products/products-summary-cards";
import { AiPageTriggerButton } from "@/components/ai-assistant/ai-page-trigger-button";
import type { ProductPageStats } from "@/lib/products-page-data";
import {
  buildProductQuickActionCards,
  buildProductSummaryCards,
  filterProductQuickActionCards,
  type ProductPagePermissions,
  type ProductQuickActionCard,
  type ProductSummaryCard,
} from "@/lib/products-page-ui-utils";
import type { ReactNode } from "react";

type ProductsShellProps = {
  stats: ProductPageStats;
  canSyncStock?: boolean;
  permissions: ProductPagePermissions;
  actionCards?: ProductQuickActionCard[];
  summaryCards?: ProductSummaryCard[];
  children: ReactNode;
};

export function ProductsShell({
  stats,
  canSyncStock = false,
  permissions,
  actionCards,
  summaryCards,
  children,
}: ProductsShellProps) {
  const quickActions =
    actionCards ??
    filterProductQuickActionCards(buildProductQuickActionCards(), permissions);
  const metrics = summaryCards ?? buildProductSummaryCards(stats);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
            Ürünler
          </h1>
          <p className="text-[12px] font-medium text-slate-500">
            Ürünlerinizi, stoklarınızı, barkodlarınızı ve fiyatlarınızı tek yerden yönetin.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <AiPageTriggerButton moduleKey="products" />
          {canSyncStock ? <ProductsStockSyncButton canSync={canSyncStock} compact /> : null}
        </div>
      </div>

      <ProductsQuickActions cards={quickActions} />
      <ProductsSummaryCards cards={metrics} />
      <ProductsSubNav />

      {children}
    </div>
  );
}
