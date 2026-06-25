"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Bot,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { AiHealthBadge, AiFallbackBanner } from "@/components/ai-assistant/ai-health-badge";
import { AiConversationSidebar } from "@/components/ai-assistant/ai-conversation-sidebar";
import { AiStructuredMessage } from "@/components/ai-assistant/ai-structured-message";
import {
  formatDateInputValue,
  QUICK_QUESTIONS,
  type AiChatMessage,
  type AiTopicKey,
} from "@/lib/ai-assistant-page-utils";

type AiAssistantChatPanelProps = {
  initialMessages: AiChatMessage[];
  initialQuestion?: string | null;
  highlight?: boolean;
  from: Date;
  to: Date;
  activeTopic: AiTopicKey;
  variant?: "page" | "drawer";
};

const EMPTY_MESSAGE_ERROR = "Lütfen bir mesaj yazın.";
const GENERIC_ERROR =
  "Asistan şu anda cevap veremiyor. Lütfen tekrar deneyin.";

function formatMessageTime(date: Date) {
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-violet-600 text-white shadow-md shadow-blue-200/60">
        <Bot size={16} strokeWidth={2.4} />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-500 [animation-delay:240ms]" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Düşünüyor...
          </span>
        </div>
      </div>
    </div>
  );
}

type ChatMessageBubbleProps = {
  message: AiChatMessage;
  index: number;
};

function ChatMessageBubble({ message, index }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const timeMatch = message.id.match(/(\d{13})/);
  const timeLabel = timeMatch
    ? formatMessageTime(new Date(Number(timeMatch[1])))
    : null;

  if (isUser) {
    return (
      <div
        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex justify-end gap-2.5 duration-500"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        <div className="max-w-[min(85%,520px)]">
          <div className="rounded-2xl rounded-tr-md bg-linear-to-br from-blue-600 to-violet-600 px-4 py-3 text-[13px] font-medium leading-6 text-white shadow-lg shadow-blue-200/50">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          {timeLabel ? (
            <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
              {timeLabel}
            </p>
          ) : null}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <UserRound size={16} strokeWidth={2.2} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both flex items-start gap-2.5 duration-500"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-violet-600 text-white shadow-md shadow-blue-200/60">
        <Bot size={16} strokeWidth={2.4} />
      </div>
      <div className="max-w-[min(85%,620px)]">
        <div className="rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-[13px] font-medium leading-6 text-[#24345f] shadow-sm">
          <AiStructuredMessage
            content={message.content}
            structured={message.structured}
          />
        </div>
        {timeLabel ? (
          <p className="mt-1 text-[10px] font-semibold text-slate-400">
            {timeLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type ChatPanelChromeProps = {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onCloseFullscreen?: () => void;
  highlight?: boolean;
  showHeader?: boolean;
  showFullscreenToggle?: boolean;
  children: ReactNode;
  footer: ReactNode;
};

function ChatPanelChrome({
  isFullscreen,
  onToggleFullscreen,
  onCloseFullscreen,
  highlight,
  showHeader = true,
  showFullscreenToggle = true,
  children,
  footer,
}: ChatPanelChromeProps) {
  const header = showHeader ? (
    <div
      className={[
        "relative shrink-0 overflow-hidden border-b border-white/10 px-4 py-3.5 sm:px-5",
        isFullscreen
          ? "bg-linear-to-r from-[#0f1f4d] via-[#1a2f6b] to-[#2d1b69]"
          : "rounded-t-2xl bg-linear-to-r from-[#0f1f4d] via-[#1a2f6b] to-[#2d1b69]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-violet-400/20 blur-2xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white shadow-inner backdrop-blur-sm">
            <Sparkles size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-black text-white sm:text-[16px]">
              AI Finans Asistanı
            </h3>
            <p className="truncate text-[11px] font-medium text-blue-100/90">
              İşletme verilerinize dayalı akıllı yanıtlar
            </p>
            <div className="mt-1">
              <AiHealthBadge />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {showFullscreenToggle ? (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              title={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
            >
              {isFullscreen ? (
                <Minimize2 size={17} strokeWidth={2.4} />
              ) : (
                <Maximize2 size={17} strokeWidth={2.4} />
              )}
            </button>
          ) : null}
          {isFullscreen && onCloseFullscreen ? (
            <button
              type="button"
              onClick={onCloseFullscreen}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:hidden"
              aria-label="Kapat"
            >
              <X size={17} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const shell = (
    <section
      id="ai-chat-panel"
      className={[
        "flex flex-col overflow-hidden bg-white",
        isFullscreen || !showHeader
          ? "h-full"
          : [
              "animate-in fade-in slide-in-from-bottom-3 fill-mode-both rounded-2xl border shadow-[0_10px_28px_rgba(15,23,42,0.04)] duration-700",
              highlight
                ? "border-blue-300 ring-2 ring-blue-100"
                : "border-slate-200/80",
            ].join(" "),
      ].join(" ")}
      style={isFullscreen || !showHeader ? undefined : { animationDelay: "180ms" }}
    >
      {header}
      {children}
      {footer}
    </section>
  );

  return shell;
}

export function AiAssistantChatPanel({
  initialMessages,
  initialQuestion,
  highlight = false,
  from,
  to,
  activeTopic,
  variant = "page",
}: AiAssistantChatPanelProps) {
  const isDrawer = variant === "drawer";
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryQuestion, setRetryQuestion] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [conversationRefreshKey, setConversationRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handledInitial = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, error, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!initialQuestion || handledInitial.current) return;
    handledInitial.current = true;
    void sendQuestion(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, isFullscreen ? 160 : 120)}px`;
  }, [input, isFullscreen]);

  function startNewConversation() {
    setConversationId(null);
    setMessages(initialMessages);
    setFallbackNotice(null);
    setError(null);
    setRetryQuestion(null);
  }

  function loadConversation(
    id: string,
    loadedMessages: Array<{
      id: string;
      role: string;
      content: string;
      structuredContent?: unknown;
    }>
  ) {
    setConversationId(id);
    setFallbackNotice(null);
    setMessages(
      loadedMessages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        structured: msg.structuredContent,
      }))
    );
  }

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      setError(EMPTY_MESSAGE_ERROR);
      return;
    }

    if (isTyping) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError(null);
    setRetryQuestion(null);
    setIsTyping(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationId || undefined,
          context: activeTopic === "all" ? "dashboard" : activeTopic,
          from: formatDateInputValue(from),
          to: formatDateInputValue(to),
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        conversationId?: string;
        responseMode?: "openai" | "rules_fallback";
        fallbackNotice?: string | null;
        structured?: unknown;
      };

      if (!response.ok || !data.success || !data.message) {
        throw new Error(data.message || GENERIC_ERROR);
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
        setConversationRefreshKey((key) => key + 1);
      }

      setFallbackNotice(
        data.responseMode === "rules_fallback"
          ? data.fallbackNotice ||
              "Bu yanıt kural tabanlı yedek modda üretildi; OpenAI kullanılmadı."
          : null
      );

      const assistantMessage: AiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        structured: data.structured,
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : GENERIC_ERROR;
      setError(message);
      setRetryQuestion(trimmed);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  const messageArea = (
    <div
      ref={scrollRef}
      className={[
        "flex-1 space-y-4 overflow-y-auto bg-linear-to-b from-slate-50/90 to-white p-4 sm:p-5",
        isFullscreen || isDrawer
          ? "min-h-0"
          : "max-h-[min(52vh,420px)] min-h-[280px]",
      ].join(" ")}
    >
      {messages.length <= 1 ? (
        <div className="mx-auto mb-2 max-w-lg rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Bot size={24} strokeWidth={2.2} />
          </div>
          <p className="text-[14px] font-black text-[#0f1f4d]">
            Size nasıl yardımcı olabilirim?
          </p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">
            Satış, gider, stok ve tahsilat hakkında sorular sorabilirsiniz.
          </p>
        </div>
      ) : null}

      {fallbackNotice ? <AiFallbackBanner notice={fallbackNotice} /> : null}

      {messages.map((message, index) => (
        <ChatMessageBubble key={message.id} message={message} index={index} />
      ))}

      {isTyping ? <TypingIndicator /> : null}
    </div>
  );

  const composer = (
    <div
      className={[
        "shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4",
        isFullscreen || isDrawer ? "" : "rounded-b-2xl",
      ].join(" ")}
    >
      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle
              size={16}
              className="mt-0.5 shrink-0 text-rose-500"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-rose-700">{error}</p>
              {retryQuestion ? (
                <button
                  type="button"
                  onClick={() => void sendQuestion(retryQuestion)}
                  disabled={isTyping}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={12} />
                  Tekrar dene
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void sendQuestion(question)}
            disabled={isTyping}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-[#24345f] transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-wait disabled:opacity-60"
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
        className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (error === EMPTY_MESSAGE_ERROR) {
              setError(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendQuestion(input);
            }
          }}
          placeholder="Mesajınızı yazın... (Enter gönderir, Shift+Enter satır atlar)"
          rows={1}
          className="max-h-[160px] min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[13px] font-medium text-[#24345f] outline-none placeholder:text-slate-400"
        />

        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200/60 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Gönder"
          title="Gönder"
        >
          <Send size={18} strokeWidth={2.6} />
        </button>
      </form>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
        <Sparkles size={11} />
        Yanıtlar işletme verilerinize göre üretilir
        {isFullscreen ? (
          <span className="text-slate-300">· Esc ile çık</span>
        ) : null}
      </p>
    </div>
  );

  const panel = isDrawer ? (
    <ChatPanelChrome
      isFullscreen={false}
      onToggleFullscreen={() => undefined}
      showHeader={false}
      showFullscreenToggle={false}
      footer={composer}
    >
      {messageArea}
    </ChatPanelChrome>
  ) : (
    <div className={isFullscreen ? "flex h-full min-h-0 gap-0" : "grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]"}>
      {!isFullscreen ? (
        <AiConversationSidebar
          activeConversationId={conversationId}
          onSelectConversation={loadConversation}
          onNewConversation={startNewConversation}
          refreshKey={conversationRefreshKey}
        />
      ) : null}
      <ChatPanelChrome
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((current) => !current)}
        onCloseFullscreen={() => setIsFullscreen(false)}
        highlight={highlight}
        footer={composer}
      >
        {messageArea}
      </ChatPanelChrome>
    </div>
  );

  if (isFullscreen && mounted) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/40 p-0 backdrop-blur-sm sm:p-3 md:p-5">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-slate-200/80">
          {panel}
        </div>
      </div>,
      document.body
    );
  }

  return panel;
}
