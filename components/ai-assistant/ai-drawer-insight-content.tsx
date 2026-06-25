"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  AiInsightMetaFooter,
  AiStructuredMessage,
} from "@/components/ai-assistant/ai-structured-message";
import { AiFallbackBanner } from "@/components/ai-assistant/ai-health-badge";
import type { AiStructuredResponse } from "@/lib/ai/ai-structured-output";
import {
  AI_INSIGHT_TITLES,
  getAiInsightEndpoint,
  type AiInsightModuleKey,
} from "@/lib/ai/ai-drawer-utils";

type AiInsightPayload = {
  commentary?: string;
  blocks?: AiStructuredResponse["blocks"];
  sourceModules?: string[];
  period?: { from: string; to: string };
  generatedAt?: string;
  responseMode?: "openai" | "rules_fallback";
};

type AiDrawerInsightContentProps = {
  moduleKey: AiInsightModuleKey;
  enabled: boolean;
};

export function AiDrawerInsightContent({
  moduleKey,
  enabled,
}: AiDrawerInsightContentProps) {
  const [data, setData] = useState<AiInsightPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(getAiInsightEndpoint(moduleKey))
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setData(result.data as AiInsightPayload);
        } else {
          setError(result.message || "Özet yüklenemedi.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Özet yüklenirken bir hata oluştu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, moduleKey]);

  const title = AI_INSIGHT_TITLES[moduleKey];

  if (!enabled) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Sparkles size={20} />
        </div>
        <p className="text-[13px] font-bold text-[#0f1f4d]">AI özeti hazır</p>
        <p className="mt-1 max-w-[240px] text-[12px] font-medium leading-5 text-slate-500">
          Bu sekmede modül bağlamına göre üretilmiş özet görüntülenir.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="animate-spin text-violet-400" size={22} />
        <p className="text-[12px] font-semibold text-slate-500">Özet hazırlanıyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] font-bold text-rose-600">{error}</p>
        <p className="mt-2 text-[12px] font-medium text-slate-500">
          Lütfen daha sonra tekrar deneyin.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] font-medium text-slate-500">Özet verisi bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-violet-600" />
          <h3 className="text-[13px] font-black text-[#0f1f4d]">{title}</h3>
        </div>
        <Link
          href="/ai-assistant"
          className="shrink-0 text-[11px] font-bold text-violet-700 underline"
        >
          Tam ekran
        </Link>
      </div>

      {data.responseMode === "rules_fallback" ? (
        <AiFallbackBanner notice="Bu özet kural tabanlı yedek modda üretildi." />
      ) : null}

      <AiStructuredMessage
        content={data.commentary || ""}
        structured={
          data.blocks
            ? { blocks: data.blocks, sourceModules: data.sourceModules || [] }
            : null
        }
      />

      <AiInsightMetaFooter
        period={data.period}
        sourceModules={data.sourceModules}
        generatedAt={data.generatedAt}
        responseMode={data.responseMode}
      />
    </div>
  );
}
