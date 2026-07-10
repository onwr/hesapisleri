"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { AiStructuredMessage } from "@/components/ai-assistant/ai-structured-message";
import {
  endOfMonth,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import { formatDateInputValue } from "@/lib/ai-assistant-page-utils";

const DASHBOARD_QUICK_QUESTIONS = [
  "Bu ay kârda mıyım?",
  "Stokta riskli ürün var mı?",
  "Nakit akışım sağlıklı mı?",
] as const;

type DashboardAiAssistantPanelProps = {
  insights?: string[];
};

const FALLBACK_INSIGHTS = ["Size nasıl yardımcı olabilirim?"];

export function DashboardAiAssistantPanel({
  insights,
}: DashboardAiAssistantPanelProps) {
  const safeInsights = useMemo(() => {
    if (Array.isArray(insights) && insights.length > 0) {
      return insights;
    }
    return FALLBACK_INSIGHTS;
  }, [insights]);

  const [activeInsight, setActiveInsight] = useState(0);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [assistantReply, setAssistantReply] = useState<string | null>(null);
  const [assistantStructured, setAssistantStructured] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    return {
      from: formatDateInputValue(startOfMonth(now)),
      to: formatDateInputValue(endOfMonth(now)),
    };
  }, []);

  useEffect(() => {
    if (safeInsights.length <= 1 || assistantReply) return;

    const timer = window.setInterval(() => {
      setActiveInsight((current) => (current + 1) % safeInsights.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [assistantReply, safeInsights.length]);

  async function askAssistant(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLastQuestion(trimmed);
    setAssistantReply(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context: "dashboard",
          from: dateRange.from,
          to: dateRange.to,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        structured?: unknown;
      };

      if (!response.ok || !data.success || !data.message) {
        throw new Error(
          data.message || "Asistan şu anda cevap veremiyor. Lütfen tekrar deneyin."
        );
      }

      setAssistantReply(data.message);
      setAssistantStructured(data.structured ?? null);
      setInput("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Asistan şu anda cevap veremiyor. Lütfen tekrar deneyin.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const detailHref = lastQuestion
    ? `/ai-assistant?topic=chat&q=${encodeURIComponent(lastQuestion)}`
    : "/ai-assistant?topic=chat";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <Image
          src="/robot.png"
          alt="Akıllı Asistan"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />

        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold text-[#0f1f4d]">
            Akıllı Asistan
          </h3>
          <p className="text-[11px] font-semibold text-slate-400">
            İşletme verilerinize göre öneriler
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-linear-to-br from-blue-50 via-slate-50 to-violet-50 p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
            <Loader2 size={14} className="animate-spin text-blue-600" />
            Yanıt hazırlanıyor...
          </div>
        ) : assistantReply ? (
          <AiStructuredMessage
            content={assistantReply}
            structured={assistantStructured ?? undefined}
          />
        ) : (
          <p className="text-[13px] font-medium leading-5 text-[#24345f]">
            {safeInsights[activeInsight] ?? safeInsights[0]}
          </p>
        )}

        {lastQuestion && assistantReply ? (
          <p className="mt-2 text-[11px] font-semibold text-slate-400">
            Soru: {lastQuestion}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-semibold text-rose-600">{error}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DASHBOARD_QUICK_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void askAssistant(question)}
            disabled={isLoading}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-[#24345f] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-wait disabled:opacity-60"
          >
            {question}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void askAssistant(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Bir soru sorun..."
          disabled={isLoading}
          className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-50 disabled:opacity-60"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Soruyu gönder"
        >
          <Send size={15} strokeWidth={2.4} />
        </button>
      </form>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          href={detailHref}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-blue-100 bg-white px-4 text-[12px] font-bold text-blue-600 shadow-sm transition hover:bg-blue-50"
        >
          {assistantReply ? "Sohbete devam et" : "Detayları Gör"}
        </Link>

        {assistantReply ? (
          <button
            type="button"
            onClick={() => {
              setAssistantReply(null);
              setAssistantStructured(null);
              setLastQuestion(null);
              setError(null);
            }}
            className="text-[11px] font-bold text-slate-500 transition hover:text-slate-700"
          >
            Önerilere dön
          </button>
        ) : null}
      </div>

      {!assistantReply && safeInsights.length > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {safeInsights.map((_, index) => (
            <button
              key={`insight-dot-${index}`}
              type="button"
              onClick={() => setActiveInsight(index)}
              aria-label={`Öneri ${index + 1}`}
              className={[
                "h-1.5 rounded-full transition-all",
                index === activeInsight
                  ? "w-4 bg-[#0f1f4d]"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400",
              ].join(" ")}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-400">
          <Sparkles size={11} />
          Enter ile hızlı soru gönderebilirsiniz
        </p>
      )}
    </div>
  );
}
