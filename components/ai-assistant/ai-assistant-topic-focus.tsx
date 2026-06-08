"use client";

import { useEffect } from "react";
import type { AiTopicKey } from "@/lib/ai-assistant-page-utils";

type AiAssistantTopicFocusProps = {
  activeTopic: AiTopicKey;
};

export function AiAssistantTopicFocus({ activeTopic }: AiAssistantTopicFocusProps) {
  useEffect(() => {
    if (activeTopic !== "chat") return;

    const timer = window.setTimeout(() => {
      document.getElementById("ai-chat-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 420);

    return () => window.clearTimeout(timer);
  }, [activeTopic]);

  return null;
}
