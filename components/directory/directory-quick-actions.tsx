"use client";

import { ArrowRight } from "lucide-react";
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
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const className = [
          "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
          card.gradient,
        ].join(" ");

        const content = (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                <Icon size={22} strokeWidth={2.4} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[15px] font-black leading-tight">
                  {card.title}
                </p>
                <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                  {card.description}
                </p>
              </div>
            </div>

            <ArrowRight
              size={18}
              strokeWidth={3}
              className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
            />
          </>
        );

        if (card.key === "export") {
          return (
            <a key={card.key} href={exportHref} className={className}>
              {content}
            </a>
          );
        }

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onAction(card.key)}
            className={className}
          >
            {content}
          </button>
        );
      })}
    </section>
  );
}
