"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  content: string;
  category: string;
  priority: string;
  isPinned: boolean;
  author: { name: string };
  createdAt: string;
};

export function AdminCompanyNotesPanel({
  companyId,
  notes,
}: {
  companyId: string;
  notes: Note[];
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createNote() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, category, priority: "NORMAL" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Not eklenemedi");
      setContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
        Notlara şifre, API anahtarı veya credential yazmayın. Bu notlar yalnız platform adminlerine görünür.
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Platform iç notu..."
          className="min-h-[90px] w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-2 text-sm"
          >
            <option value="GENERAL">Genel</option>
            <option value="BILLING">Faturalama</option>
            <option value="SUPPORT">Destek</option>
            <option value="RISK">Risk</option>
            <option value="SALES">Satış</option>
            <option value="TECHNICAL">Teknik</option>
          </select>
          <button
            type="button"
            disabled={loading || content.trim().length < 2}
            onClick={() => void createNote()}
            className="rounded-xl bg-[#0f1f4d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Not ekle
          </button>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>

      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz not yok.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-slate-500">
                  {note.category} · {note.author.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(note.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
