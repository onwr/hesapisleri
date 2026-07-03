"use client";

import {
  CompactActionCard,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";
import {
  filterDirectoryQuickActionCards,
  buildDirectoryQuickActionCards,
  type DirectoryQuickActionKey,
} from "@/lib/directory-page-ui-utils";

type DirectoryQuickActionsProps = {
  canManage: boolean;
  exportHref: string;
  onAction: (key: DirectoryQuickActionKey) => void;
};

export function DirectoryQuickActions({
  canManage,
  exportHref,
  onAction,
}: DirectoryQuickActionsProps) {
  const cards = filterDirectoryQuickActionCards(
    buildDirectoryQuickActionCards(),
    canManage
  );

  if (cards.length === 0) return null;

  return (
    <CompactActionCardGrid columns="5">
      {cards.map((card) => {
        if (card.key === "export") {
          return (
            <CompactActionCard
              key={card.key}
              title={card.title}
              description={card.description}
              href={exportHref}
              iconName={card.iconName}
              color={card.color}
            />
          );
        }

        return (
          <CompactActionCard
            key={card.key}
            title={card.title}
            description={card.description}
            iconName={card.iconName}
            color={card.color}
            onClick={() => onAction(card.key)}
          />
        );
      })}
    </CompactActionCardGrid>
  );
}
