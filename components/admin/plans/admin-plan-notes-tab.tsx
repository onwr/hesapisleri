"use client";

import { useState } from "react";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
} from "@/lib/admin-ui";
import { formatAdminDate } from "@/lib/admin-utils";
import { ADMIN_PLAN_NOTE_CATEGORIES } from "@/lib/admin/plans/admin-plan-schemas";

type Note = {
  id: string;
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
  author: { name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

type Props = { planId: string; data: { notes: Note[] } | null; onRefresh: () => void };

export function AdminPlanNotesTab({ planId, data, onRefresh }: Props) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notes = data?.notes ?? [];

  async function createNote() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category, priority: "NORMAL" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setContent("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(note: Note) {
    await fetch(`/api/admin/plans/${planId}/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !note.isPinned }),
    });
    onRefresh();
  }

  async function removeNote(noteId: string) {
    if (!confirm("Not silinsin mi?")) return;
    await fetch(`/api/admin/plans/${planId}/notes/${noteId}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div>
      <div className={`${appPanelClass} mb-4 p-3 text-[12px] text-amber-800`}>
        Notlara şifre, API anahtarı veya credential yazmayın. İçerik düz metin olarak gösterilir.
      </div>

      <div className="mb-4 space-y-2">
        <textarea
          className="min-h-[80px] w-full rounded border p-2 text-[12px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Plan notu…"
        />
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded border px-2 py-1 text-[12px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {ADMIN_PLAN_NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={appPrimaryButtonClass}
            disabled={busy || content.trim().length < 1}
            onClick={() => void createNote()}
          >
            Not ekle
          </button>
        </div>
        {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      </div>

      {notes.length === 0 ? (
        <p className="text-[12px] text-slate-500">Henüz not yok.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className={`${appPanelClass} p-3 text-[12px]`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-700">
                  {note.category} · {note.priority}
                  {note.isPinned ? " · 📌" : ""}
                </span>
                <span className="text-[10px] text-slate-500">
                  {note.author?.name ?? note.author?.email ?? "—"} · {formatAdminDate(note.updatedAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-slate-800">{note.content}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={appOutlineButtonClass} onClick={() => void togglePin(note)}>
                  {note.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
                </button>
                <button type="button" className={appOutlineButtonClass} onClick={() => void removeNote(note.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
