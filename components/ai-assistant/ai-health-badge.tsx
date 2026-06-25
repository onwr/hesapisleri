"use client";

import { useEffect, useState } from "react";

type AiHealthReport = {
  status: string;
  label: string;
  message: string;
  provider: string;
  canChat: boolean;
  usesRulesFallback: boolean;
  openAiConfigured?: boolean;
  costAlertExceeded?: boolean;
  rateLimited?: boolean;
};

const STATUS_STYLES: Record<string, string> = {
  OPENAI_ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RULE_BASED_FALLBACK: "bg-amber-50 text-amber-800 border-amber-200",
  DISABLED: "bg-slate-100 text-slate-600 border-slate-200",
  MISSING_API_KEY: "bg-rose-50 text-rose-700 border-rose-200",
  INVALID_API_KEY: "bg-rose-50 text-rose-700 border-rose-200",
  RATE_LIMITED: "bg-orange-50 text-orange-700 border-orange-200",
  PROVIDER_UNAVAILABLE: "bg-rose-50 text-rose-700 border-rose-200",
};

export function AiHealthBadge({ className = "" }: { className?: string }) {
  const [health, setHealth] = useState<AiHealthReport | null>(null);

  useEffect(() => {
    void fetch("/api/ai/health")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setHealth(result.data as AiHealthReport);
      })
      .catch(() => undefined);
  }, []);

  if (!health) return null;

  return (
    <div
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
        STATUS_STYLES[health.status] || STATUS_STYLES.DISABLED,
        className,
      ].join(" ")}
      title={health.message}
    >
      {health.label}
    </div>
  );
}

export function AiFallbackBanner({ notice }: { notice: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900">
      {notice}
    </div>
  );
}
