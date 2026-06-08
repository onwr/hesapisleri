"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Filter,
  MessageCircle,
  Package,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  AI_TOPIC_LABELS,
  buildAiAssistantQuery,
  formatDateInputValue,
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
    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[12px] font-extrabold text-[#24345f]/80">
            Analiz Dönemi
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            Aktif odak: {AI_TOPIC_LABELS[activeTopic]}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-[#0f1f4d]">
            <CalendarDays size={16} className="shrink-0 text-slate-500" />
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
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <Filter size={16} />
            {isPending ? "Güncelleniyor..." : "Analizi Güncelle"}
          </button>
        </form>
      </div>
    </div>
  );
}

type AiAssistantActionCardsProps = {
  cards: Array<{
    title: string;
    description: string;
    topic: AiTopicKey;
    gradient: string;
    iconKey: "brain" | "wallet" | "package" | "receipt" | "message";
  }>;
  from: Date;
  to: Date;
  activeTopic: AiTopicKey;
};

const iconMap = {
  brain: Brain,
  wallet: Wallet,
  package: Package,
  receipt: ReceiptText,
  message: MessageCircle,
};

export function AiAssistantActionCards({
  cards,
  from,
  to,
  activeTopic,
}: AiAssistantActionCardsProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card, index) => {
        const isActive = card.topic === activeTopic;
        const Icon = iconMap[card.iconKey];

        return (
          <Link
            key={card.title}
            href={buildAiAssistantQuery({ topic: card.topic, from, to })}
            className={[
              "animate-in fade-in slide-in-from-bottom-3 fill-mode-both group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
              card.gradient,
              isActive ? "ring-2 ring-white/70 ring-offset-2 ring-offset-slate-100" : "",
            ].join(" ")}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                <Icon size={22} strokeWidth={2.4} className="text-white" />
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
              className="shrink-0 text-white opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
            />
          </Link>
        );
      })}
    </section>
  );
}
