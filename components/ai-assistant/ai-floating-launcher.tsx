"use client";

import { Sparkles } from "lucide-react";
import { useAiDrawer } from "@/components/ai-assistant/ai-drawer-context";
import type { AiPlatformStatus } from "@/lib/ai/ai-config";

type AiFloatingLauncherProps = {
  platformStatus?: AiPlatformStatus;
};

// Drawer açıkken buton görünmez — z-index çakışması ve çift odak önlenir.
export function AiFloatingLauncher({ platformStatus = "enabled" }: AiFloatingLauncherProps) {
  const { state, openFinance } = useAiDrawer();

  if (state.open) return null;

  function handleClick() {
    // Finans Asistanı her platformStatus'da varsayılan sekme olarak açılır.
    openFinance();
  }

  const label = "Finans Asistanı";

  return (
    <div
      className="fixed right-3 sm:right-4 md:right-5 z-[var(--z-floating)] flex flex-col items-end gap-2"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="group inline-flex h-11 min-h-[44px] min-w-[44px] max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-violet-200/80 bg-white/95 px-3 py-2 text-[#0f1f4d] shadow-lg shadow-slate-300/30 backdrop-blur-sm transition hover:border-violet-300 hover:shadow-xl"
        aria-label={`${label} asistanını aç`}
        title={label}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-md shadow-blue-300/30">
          <Sparkles size={17} />
        </span>
        <span className="hidden max-w-[8rem] truncate text-[12px] font-extrabold sm:inline">
          {label}
        </span>
      </button>
    </div>
  );
}
