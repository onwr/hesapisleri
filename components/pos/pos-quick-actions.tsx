"use client";

import {
  buildPosQuickActionCards,
  type PosQuickActionKey,
} from "@/lib/pos-page-ui-utils";

type PosQuickActionsProps = {
  onAction: (key: PosQuickActionKey) => void;
};

export function PosQuickActions({ onAction }: PosQuickActionsProps) {
  const cards = buildPosQuickActionCards();

  return (
    <section className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onAction(card.key)}
            className={[
              "group flex h-[78px] min-w-[210px] shrink-0 items-center justify-between rounded-2xl p-3.5 text-left text-white shadow-[0_12px_26px_rgba(15,23,42,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.14)] sm:min-w-0",
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
          </button>
        );
      })}
    </section>
  );
}
