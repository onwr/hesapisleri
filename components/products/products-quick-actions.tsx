"use client";

import Link from "next/link";
import {
  ArrowRight,
  Barcode,
  Boxes,
  Link2,
  Plus,
  Sparkles,
  Warehouse,
} from "lucide-react";
import type { ProductQuickActionCard } from "@/lib/products-page-ui-utils";

const iconMap = {
  plus: Plus,
  service: Sparkles,
  movement: Boxes,
  warehouse: Warehouse,
  mapping: Link2,
  barcode: Barcode,
} as const;

type ProductsQuickActionsProps = {
  cards: ProductQuickActionCard[];
};

export function ProductsQuickActions({ cards }: ProductsQuickActionsProps) {
  if (cards.length === 0) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = iconMap[card.iconKey];

        return (
          <Link
            key={card.key}
            href={card.href}
            className={[
              "group flex h-[78px] items-center justify-between rounded-2xl p-3.5 text-white shadow-[0_12px_26px_rgba(15,23,42,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.14)]",
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

            <ArrowRight
              size={16}
              strokeWidth={3}
              className="shrink-0 opacity-90 transition group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </Link>
        );
      })}
    </section>
  );
}
