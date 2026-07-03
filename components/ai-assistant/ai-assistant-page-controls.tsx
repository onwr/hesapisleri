"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Filter } from "lucide-react";
import {
  CompactActionCard,
  type CompactActionIconName,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";
import {
  AI_TOPIC_LABELS,
  buildAiAssistantQuery,
  formatDateInputValue,
  type AiActionCard,
  type AiTopicKey,
} from "@/lib/ai-assistant-page-utils";

type AiAssistantPageControlsProps = {
  activeTopic: AiTopicKey;
  from: Date;
  to: Date;
};

export function AiAssistantPageControls({
  activeTopic,
  from,
  to,
}: AiAssistantPageControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(() => formatDateInputValue(from));
  const [toDate, setToDate] = useState(() => formatDateInputValue(to));

  useEffect(() => {
    setFromDate(formatDateInputValue(from));
    setToDate(formatDateInputValue(to));
  }, [from, to]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let nextFrom = fromDate;
    let nextTo = toDate;

    if (nextFrom > nextTo) {
      [nextFrom, nextTo] = [nextTo, nextFrom];
      setFromDate(nextFrom);
      setToDate(nextTo);
    }

    startTransition(() => {
      router.push(
        buildAiAssistantQuery({
          topic: activeTopic,
          from: nextFrom,
          to: nextTo,
        })
      );
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[12px] font-extrabold text-[#24345f]/80">
            Analiz Dönemi
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
            Aktif odak: {AI_TOPIC_LABELS[activeTopic]}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-[#0f1f4d]">
            <CalendarDays size={15} className="shrink-0 text-slate-500" />
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-[118px] bg-transparent outline-none"
              aria-label="Başlangıç tarihi"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-[118px] bg-transparent outline-none"
              aria-label="Bitiş tarihi"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <Filter size={15} />
            {isPending ? "Güncelleniyor..." : "Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}

type AiAssistantActionCardsProps = {
  cards: AiActionCard[];
  from: Date;
  to: Date;
  activeTopic: AiTopicKey;
};

const aiActionIconMap: Record<AiActionCard["iconKey"], CompactActionIconName> = {
  brain: "brain",
  wallet: "wallet",
  package: "package",
  receipt: "receipt-text",
  message: "message-circle",
};

export function AiAssistantActionCards({
  cards,
  from,
  to,
  activeTopic,
}: AiAssistantActionCardsProps) {
  return (
    <CompactActionCardGrid columns="5">
      {cards.map((card) => (
        <CompactActionCard
          key={card.title}
          title={card.title}
          description={card.description}
          href={buildAiAssistantQuery({ topic: card.topic, from, to })}
          iconName={aiActionIconMap[card.iconKey]}
          color={card.color}
          className={card.topic === activeTopic ? "border-blue-300 ring-1 ring-blue-100" : undefined}
        />
      ))}
    </CompactActionCardGrid>
  );
}
