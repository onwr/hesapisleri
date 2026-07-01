"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BarChart3, Bot, Sparkles } from "lucide-react";
import { AiAssistantChatPanel } from "@/components/ai-assistant/ai-assistant-chat-panel";
import { AiDrawerInsightContent } from "@/components/ai-assistant/ai-drawer-insight-content";
import { FinanceAssistantPanel } from "@/components/ai-assistant/finance-assistant-panel";
import { useAiDrawer } from "@/components/ai-assistant/ai-drawer-context";
import { AiHealthBadge } from "@/components/ai-assistant/ai-health-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import type { AiInsightModuleKey } from "@/lib/ai/ai-drawer-utils";

function DrawerTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-xl px-3 py-2 text-[12px] font-extrabold transition",
        active
          ? "bg-white text-[#0f1f4d] shadow-sm"
          : "text-slate-500 hover:text-slate-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function GlobalAiDrawer() {
  const pathname = usePathname();
  const { state, close, setTab } = useAiDrawer();
  const [isMobile, setIsMobile] = useState(false);

  const now = useMemo(() => new Date(), []);
  const dateRange = useMemo(
    () => ({ from: startOfMonth(now), to: endOfMonth(now) }),
    [now]
  );

  const insightModuleKey: AiInsightModuleKey =
    state.moduleKey ?? "dashboard";

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (pathname === "/ai-assistant") {
    return null;
  }

  return (
    <Sheet open={state.open} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={[
          "flex w-full flex-col gap-0 border-slate-200/80 p-0",
          isMobile
            ? "h-[96dvh] max-h-[96dvh] rounded-t-3xl"
            : "w-[min(100vw,480px)] max-w-[480px] sm:max-w-[480px]",
        ].join(" ")}
      >
        <SheetHeader className="shrink-0 border-b border-slate-100 px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2 text-[15px] font-black text-[#0f1f4d]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-white">
                  {state.tab === "finance" ? <BarChart3 size={16} /> : <Bot size={16} />}
                </span>
                {state.tab === "finance" ? "Finans Asistanı" : "Yapay Zekâ"}
              </SheetTitle>
              <SheetDescription className="mt-1 text-[11px] font-medium text-slate-500">
                {state.tab === "finance"
                  ? "Satış, kâr, stok, gider ve kasa verilerinizi hızlıca analiz edin."
                  : "İşletme verilerinize göre sohbet ve modül özetleri"}
              </SheetDescription>
            </div>
            <AiHealthBadge className="shrink-0" />
          </div>

          <div className="mt-3 flex gap-1 rounded-2xl bg-slate-100 p-1">
            <DrawerTabButton
              active={state.tab === "chat"}
              onClick={() => setTab("chat")}
            >
              Sohbet
            </DrawerTabButton>
            <DrawerTabButton
              active={state.tab === "insight"}
              onClick={() => setTab("insight")}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <Sparkles size={12} />
                Özet
              </span>
            </DrawerTabButton>
            <DrawerTabButton
              active={state.tab === "finance"}
              onClick={() => setTab("finance")}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <BarChart3 size={12} />
                Finans
              </span>
            </DrawerTabButton>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {state.tab === "chat" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <AiAssistantChatPanel
                variant="drawer"
                initialMessages={[
                  {
                    id: "welcome",
                    role: "assistant",
                    content:
                      "Merhaba! İşletme verileriniz hakkında soru sorabilirsiniz.",
                  },
                ]}
                from={dateRange.from}
                to={dateRange.to}
                activeTopic="chat"
              />
            </div>
          ) : state.tab === "finance" ? (
            <FinanceAssistantPanel />
          ) : (
            <AiDrawerInsightContent
              moduleKey={insightModuleKey}
              enabled={state.open && state.tab === "insight"}
            />
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 text-center">
          <Link
            href="/ai-assistant"
            className="text-[11px] font-bold text-blue-600 underline"
          >
            Tam ekran asistan
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
