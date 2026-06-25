"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  AiInsightMetaFooter,
  AiStructuredMessage,
} from "@/components/ai-assistant/ai-structured-message";
import { AiFallbackBanner } from "@/components/ai-assistant/ai-health-badge";
import type { AiStructuredResponse } from "@/lib/ai/ai-structured-output";

type AiInsightPayload = {
  commentary?: string;
  blocks?: AiStructuredResponse["blocks"];
  sourceModules?: string[];
  period?: { from: string; to: string };
  generatedAt?: string;
  responseMode?: "openai" | "rules_fallback";
};

type AiModuleInsightCardProps = {
  moduleKey: "sales" | "products" | "cash-bank" | "invoices" | "customers";
  title: string;
};

export function AiModuleInsightCard({ moduleKey, title }: AiModuleInsightCardProps) {
  const [data, setData] = useState<AiInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/ai/insights/${moduleKey}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data as AiInsightPayload);
      })
      .finally(() => setLoading(false));
  }, [moduleKey]);

  return (
    <div className="rounded-2xl border border-violet-100/80 bg-linear-to-br from-white to-violet-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-violet-600" />
        <h4 className="text-[13px] font-black text-[#0f1f4d]">{title}</h4>
      </div>
      {loading ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="animate-spin text-slate-300" size={16} />
        </div>
      ) : data ? (
        <>
          {data.responseMode === "rules_fallback" ? (
            <AiFallbackBanner notice="Bu özet kural tabanlı yedek modda üretildi." />
          ) : null}
          <AiStructuredMessage
            content={data.commentary || ""}
            structured={
              data.blocks ? { blocks: data.blocks, sourceModules: data.sourceModules || [] } : null
            }
          />
          <AiInsightMetaFooter
            period={data.period}
            sourceModules={data.sourceModules}
            generatedAt={data.generatedAt}
            responseMode={data.responseMode}
          />
        </>
      ) : (
        <p className="text-[11px] font-medium text-slate-500">Özet verisi bulunamadı.</p>
      )}
    </div>
  );
}
