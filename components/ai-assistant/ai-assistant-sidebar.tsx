"use client";

import {
  Banknote,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AiSignalRow } from "@/lib/ai-assistant-page-utils";

type AiAssistantSidebarProps = {
  signals: AiSignalRow[];
};

const iconMap = {
  trendingUp: TrendingUp,
  wallet: Wallet,
  package: Package,
  banknote: Banknote,
};

const colorMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-500",
  orange: "bg-orange-50 text-orange-500",
  blue: "bg-blue-50 text-blue-600",
};

export function AiAssistantSidebar({ signals }: AiAssistantSidebarProps) {
  return (
    <>
      <section
        className="animate-in fade-in slide-in-from-right-3 fill-mode-both duration-700 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
        style={{ animationDelay: "280ms" }}
      >
        <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">Özet Sinyaller</h3>

        <div className="space-y-3">
          {signals.map((signal, index) => {
            const Icon = iconMap[signal.iconKey];

            return (
              <div
                key={signal.label}
                className="animate-in fade-in slide-in-from-right-2 fill-mode-both flex items-center gap-3 duration-500"
                style={{ animationDelay: `${320 + index * 60}ms` }}
              >
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    colorMap[signal.color],
                  ].join(" ")}
                >
                  <Icon size={15} />
                </div>

                <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#24345f]">
                  {signal.label}
                </p>

                <p className="shrink-0 text-[11px] font-black text-[#0f1f4d]">
                  {signal.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="animate-in fade-in slide-in-from-right-3 fill-mode-both duration-700 rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-blue-50 p-4"
        style={{ animationDelay: "360ms" }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
          ✨
        </div>

        <p className="mt-4 text-[14px] font-black text-[#0f1f4d]">
          Veriye dayalı akıllı yorumlar
        </p>

        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-600">
          Satış, gider, fatura ve stok verileriniz otomatik analiz edilir. Sohbet
          panelinden sorular sorarak anında yanıt alabilirsiniz.
        </p>
      </section>
    </>
  );
}
