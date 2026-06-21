"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  Plus,
} from "lucide-react";
import type { WarehouseQuickActionCard } from "@/lib/warehouses-page-ui-utils";

const iconMap = {
  plus: Plus,
  transfer: ArrowLeftRight,
  movement: Boxes,
  alert: AlertTriangle,
} as const;

type WarehousesQuickActionsProps = {
  cards: WarehouseQuickActionCard[];
  canManage: boolean;
  onAction: (key: WarehouseQuickActionCard["key"]) => void;
};

export function WarehousesQuickActions({
  cards,
  canManage,
  onAction,
}: WarehousesQuickActionsProps) {
  if (!canManage) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = iconMap[card.iconKey];

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onAction(card.key)}
            className={[
              "group flex h-[78px] w-full items-center justify-between rounded-2xl p-3.5 text-left text-white shadow-[0_12px_26px_rgba(15,23,42,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2",
              card.gradient,
            ].join(" ")}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                <Icon size={18} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-black leading-tight">
                  {card.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-white/85">
                  {card.description}
                </p>
              </div>
            </div>
            <span
              aria-hidden
              className="shrink-0 text-lg font-black opacity-90 transition group-hover:translate-x-0.5"
            >
              →
            </span>
          </button>
        );
      })}
    </section>
  );
}
