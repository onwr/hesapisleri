"use client";

import type { ProductQuickActionCard } from "@/lib/products-page-ui-utils";
import {
  CompactActionCard,
  type CompactActionColor,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";
import type { CompactActionIconName } from "@/components/cards/compact-action-card-types";

const productIconNameMap: Record<
  ProductQuickActionCard["iconKey"],
  CompactActionIconName
> = {
  plus: "plus",
  service: "sparkles",
  movement: "boxes",
  warehouse: "warehouse",
  mapping: "link-2",
  barcode: "barcode",
};

const colorMap: Record<ProductQuickActionCard["iconKey"], CompactActionColor> = {
  plus: "emerald",
  service: "violet",
  movement: "orange",
  warehouse: "blue",
  mapping: "sky",
  barcode: "amber",
};

type ProductsQuickActionsProps = {
  cards: ProductQuickActionCard[];
};

export function ProductsQuickActions({ cards }: ProductsQuickActionsProps) {
  if (cards.length === 0) return null;

  return (
    <CompactActionCardGrid columns="6">
      {cards.map((card) => (
        <CompactActionCard
          key={card.key}
          title={card.title}
          description={card.description}
          href={card.href}
          iconName={productIconNameMap[card.iconKey]}
          color={colorMap[card.iconKey]}
        />
      ))}
    </CompactActionCardGrid>
  );
}
