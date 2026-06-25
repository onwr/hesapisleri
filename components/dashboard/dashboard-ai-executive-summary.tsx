"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import {
  AiInsightMetaFooter,
  AiStructuredMessage,
} from "@/components/ai-assistant/ai-structured-message";
import { AiFallbackBanner } from "@/components/ai-assistant/ai-health-badge";
import type { AiStructuredResponse } from "@/lib/ai/ai-structured-output";

type DashboardInsight = {
  blocks: AiStructuredResponse["blocks"];
  commentary?: string;
  sourceModules?: string[];
  period?: { from: string; to: string };
  generatedAt?: string;
  responseMode?: "openai" | "rules_fallback";
};

export function DashboardAiExecutiveSummary() {
  const [data, setData] = useState<DashboardInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/ai/insights/dashboard")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data as DashboardInsight);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-28 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="animate-spin text-slate-400" size={18} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[14px] font-black text-[#0f1f4d]">
          <Sparkles size={16} className="text-violet-600" />
          AI Yönetici Özeti
        </h3>
        <Link href="/ai-assistant" className="text-[11px] font-black text-violet-700 underline">
          Asistan
        </Link>
      </div>

      {data.responseMode === "rules_fallback" ? (
        <div className="mb-3">
          <AiFallbackBanner notice="Bu özet kural tabanlı yedek modda üretildi." />
        </div>
      ) : null}

      <AiStructuredMessage
        content={data.commentary || ""}
        structured={{ blocks: data.blocks, sourceModules: data.sourceModules || [] }}
      />

      <AiInsightMetaFooter
        period={data.period}
        sourceModules={data.sourceModules}
        generatedAt={data.generatedAt}
        responseMode={data.responseMode}
      />
    </section>
  );
}
