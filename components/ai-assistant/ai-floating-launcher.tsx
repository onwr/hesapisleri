"use client";

import { Sparkles } from "lucide-react";
import { useAiDrawer } from "@/components/ai-assistant/ai-drawer-context";

export function AiFloatingLauncher() {
  const { openChat } = useAiDrawer();

  return (
    <button
      type="button"
      onClick={openChat}
      className="group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/95 px-3.5 py-2.5 text-[#0f1f4d] shadow-lg shadow-slate-300/30 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-xl lg:bottom-6 lg:right-6"
      aria-label="Yapay zekâ asistanını aç"
      title="Yapay Zekâ"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-md shadow-blue-300/30">
        <Sparkles size={17} />
      </span>
      <span className="hidden text-[12px] font-extrabold sm:inline">Yapay Zekâ</span>
    </button>
  );
}
