"use client";

import { Sparkles } from "lucide-react";
import { useAiDrawer } from "@/components/ai-assistant/ai-drawer-context";
import type { AiInsightModuleKey } from "@/lib/ai/ai-drawer-utils";

type AiPageTriggerButtonProps = {
  moduleKey: AiInsightModuleKey;
  label?: string;
  className?: string;
};

export function AiPageTriggerButton({
  moduleKey,
  label = "AI Özet",
  className = "",
}: AiPageTriggerButtonProps) {
  const { openInsight } = useAiDrawer();

  return (
    <button
      type="button"
      onClick={() => openInsight(moduleKey)}
      className={[
        "inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200/80 bg-white px-3 text-[11px] font-extrabold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50",
        className,
      ].join(" ")}
      aria-label={`${label} aç`}
    >
      <Sparkles size={13} className="text-violet-600" />
      {label}
    </button>
  );
}
