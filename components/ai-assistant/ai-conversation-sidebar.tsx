"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { groupConversationsByDate } from "@/lib/ai/ai-conversation-service";

type ConversationRow = {
  id: string;
  title: string | null;
  updatedAt: string;
  messages?: Array<{ content: string; role: string }>;
};

type AiConversationSidebarProps = {
  activeConversationId: string | null;
  onSelectConversation: (id: string, messages: Array<{ id: string; role: string; content: string; structuredContent?: unknown }>) => void;
  onNewConversation: () => void;
  refreshKey?: number;
};

export function AiConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  refreshKey = 0,
}: AiConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/conversations");
      const data = await res.json();
      if (data.success) {
        setConversations(
          (data.data as ConversationRow[]).map((row) => ({
            ...row,
            updatedAt: String(row.updatedAt),
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations, refreshKey]);

  async function openConversation(id: string) {
    const res = await fetch(`/api/ai/conversations/${id}`);
    const data = await res.json();
    if (!data.success) return;
    onSelectConversation(
      id,
      (data.data.messages || []).map((msg: {
        id: string;
        role: string;
        content: string;
        structuredContent?: unknown;
      }) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        structuredContent: msg.structuredContent,
      }))
    );
  }

  async function saveTitle(id: string) {
    const title = editTitle.trim();
    if (!title) return;
    await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setEditingId(null);
    await loadConversations();
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Bu konuşmayı silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (activeConversationId === id) onNewConversation();
    await loadConversations();
  }

  const grouped = groupConversationsByDate(
    conversations.map((row) => ({
      id: row.id,
      title: row.title,
      provider: null,
      model: null,
      updatedAt: new Date(row.updatedAt),
      preview: row.messages?.[0]?.content || null,
    }))
  );

  return (
    <aside className="flex h-full min-h-[320px] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13px] font-black text-[#0f1f4d]">Konuşmalar</h3>
        <button
          type="button"
          onClick={onNewConversation}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-black text-violet-700 transition hover:bg-violet-100"
        >
          <MessageSquarePlus size={13} />
          Yeni
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="animate-spin text-slate-300" size={18} />
          </div>
        ) : grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] font-medium text-slate-500">
            Henüz konuşma yok. Yeni bir sohbet başlatın.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const isEditing = editingId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={[
                        "group rounded-xl border px-2.5 py-2 transition",
                        isActive
                          ? "border-violet-200 bg-violet-50"
                          : "border-transparent hover:border-slate-100 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void saveTitle(item.id)}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void openConversation(item.id)}
                            className="w-full text-left"
                          >
                            <p className="truncate text-[12px] font-bold text-[#0f1f4d]">
                              {item.title || "Yeni konuşma"}
                            </p>
                            {item.preview ? (
                              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                                {item.preview}
                              </p>
                            ) : null}
                          </button>
                          <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditTitle(item.title || "");
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              aria-label="Başlığı düzenle"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteConversation(item.id)}
                              className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
