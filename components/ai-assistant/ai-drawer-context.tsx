"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AiDrawerTab, AiInsightModuleKey } from "@/lib/ai/ai-drawer-utils";

type AiDrawerState = {
  open: boolean;
  tab: AiDrawerTab;
  moduleKey: AiInsightModuleKey | null;
};

type AiDrawerContextValue = {
  state: AiDrawerState;
  openChat: () => void;
  openInsight: (moduleKey: AiInsightModuleKey) => void;
  close: () => void;
  setTab: (tab: AiDrawerTab) => void;
};

const AiDrawerContext = createContext<AiDrawerContextValue | null>(null);

export function AiDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AiDrawerState>({
    open: false,
    tab: "chat",
    moduleKey: null,
  });

  const openChat = useCallback(() => {
    setState((current) => ({
      ...current,
      open: true,
      tab: "chat",
    }));
  }, []);

  const openInsight = useCallback((moduleKey: AiInsightModuleKey) => {
    setState({
      open: true,
      tab: "insight",
      moduleKey,
    });
  }, []);

  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const setTab = useCallback((tab: AiDrawerTab) => {
    setState((current) => ({ ...current, tab }));
  }, []);

  const value = useMemo(
    () => ({ state, openChat, openInsight, close, setTab }),
    [state, openChat, openInsight, close, setTab]
  );

  return (
    <AiDrawerContext.Provider value={value}>{children}</AiDrawerContext.Provider>
  );
}

export function useAiDrawer() {
  const context = useContext(AiDrawerContext);
  if (!context) {
    throw new Error("useAiDrawer must be used within AiDrawerProvider");
  }
  return context;
}
