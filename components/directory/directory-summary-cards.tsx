"use client";

import {
  buildDirectoryExtendedSummaryCards,
  buildDirectorySummaryCards,
  getDirectorySummaryColorClass,
} from "@/lib/directory-page-ui-utils";
import type { DirectorySummary } from "@/lib/directory-service";

type DirectorySummaryCardsProps = {
  summary: DirectorySummary;
};

export function DirectorySummaryCards({ summary }: DirectorySummaryCardsProps) {
  const primaryCards = buildDirectorySummaryCards(summary);
  const extendedCards = buildDirectoryExtendedSummaryCards(summary);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {primaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {card.title}
                  </p>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                    {card.value}
                  </p>
                </div>

                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    getDirectorySummaryColorClass(card.color),
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </div>
              </div>

              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {extendedCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.key}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {card.title}
                  </p>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                    {card.value}
                  </p>
                </div>

                <div
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    getDirectorySummaryColorClass(card.color),
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.4} />
                </div>
              </div>

              <p className="mt-3 text-[11px] font-semibold text-slate-500">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
