"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import {
  generateAiAnswer,
  QUICK_QUESTIONS,
  type AiAssistantContext,
  type AiChatMessage,
} from "@/lib/ai-assistant-page-utils";

type AiAssistantChatPanelProps = {
  context: AiAssistantContext;
  initialMessages: AiChatMessage[];
  initialQuestion?: string | null;
  highlight?: boolean;
};

export function AiAssistantChatPanel({
  context,
  initialMessages,
  initialQuestion,
  highlight = false,
}: AiAssistantChatPanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledInitial = useRef(false);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!initialQuestion || handledInitial.current) return;
    handledInitial.current = true;
    void sendQuestion(initialQuestion);
  }, [initialQuestion]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isTyping) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsTyping(true);

    await new Promise((resolve) => window.setTimeout(resolve, 700));

    const answer = generateAiAnswer(trimmed, context);
    const assistantMessage: AiChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: answer,
    };

    setMessages((current) => [...current, assistantMessage]);
    setIsTyping(false);
  }

  return (
    <section
      id="ai-chat-panel"
      className={[
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700 rounded-2xl border bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
        highlight
          ? "border-blue-300 ring-2 ring-blue-100"
          : "border-slate-200/80",
      ].join(" ")}
      style={{ animationDelay: "180ms" }}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Bot size={21} strokeWidth={2.4} />
          </div>

          <div>
            <h3 className="text-[15px] font-black text-[#0f1f4d]">AI Sohbet</h3>
            <p className="text-[11px] font-medium text-slate-500">
              Finansal sorularınızı sorun
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div
          ref={scrollRef}
          className="max-h-[320px] space-y-3 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
        >
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={[
                "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500",
                message.role === "user" ? "flex justify-end" : "flex justify-start",
              ].join(" ")}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div
                className={[
                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[12px] font-medium leading-5",
                  message.role === "user"
                    ? "bg-linear-to-br from-blue-600 to-violet-600 text-white"
                    : "border border-slate-200 bg-white text-[#24345f]",
                ].join(" ")}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isTyping ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:240ms]" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          {QUICK_QUESTIONS.slice(0, 5).map((question, index) => (
            <button
              key={question}
              type="button"
              onClick={() => void sendQuestion(question)}
              disabled={isTyping}
              className="animate-in fade-in slide-in-from-right-2 fill-mode-both w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-bold text-[#24345f] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-wait disabled:opacity-60"
              style={{ animationDelay: `${220 + index * 50}ms` }}
            >
              {question}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendQuestion(input);
          }}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-2"
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Örn: Bu ay kârda mıyım?"
            rows={3}
            className="min-h-[72px] w-full resize-none rounded-xl bg-white p-3 text-[12px] font-medium text-[#24345f] outline-none placeholder:text-slate-400"
          />

          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-[12px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Gönder
            <Send size={15} strokeWidth={2.8} />
          </button>
        </form>

        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <Sparkles size={12} />
          Yanıtlar işletme verilerinize göre otomatik üretilir.
        </p>
      </div>
    </section>
  );
}
