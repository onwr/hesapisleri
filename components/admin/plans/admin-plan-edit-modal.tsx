"use client";

import { useState } from "react";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  plan: Record<string, unknown>;
  onSuccess: (msg: string) => void;
};

export function AdminPlanEditModal({ open, onClose, planId, plan, onSuccess }: Props) {
  const [name, setName] = useState(String(plan.name ?? ""));
  const [description, setDescription] = useState(String(plan.description ?? ""));
  const [sortOrder, setSortOrder] = useState(Number(plan.sortOrder ?? 100));
  const [trialEnabled, setTrialEnabled] = useState(Boolean(plan.trialEnabled));
  const [trialDays, setTrialDays] = useState(Number(plan.trialDays ?? 14));
  const [code, setCode] = useState(String(plan.code ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isDraft = plan.planStatus === "DRAFT";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || null,
        sortOrder,
        trialEnabled,
        trialDays,
      };
      if (isDraft && code) body.code = code;

      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Güncellenemedi");
        return;
      }
      onSuccess(json.message ?? "Plan güncellendi.");
    } catch {
      setError("İstek başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">Planı düzenle</h3>
        <div className="mt-4 space-y-3 text-[12px]">
          <label className="block">
            Ad
            <input className="mt-1 w-full rounded border px-2 py-1.5" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {isDraft ? (
            <label className="block">
              Kod (yalnız DRAFT)
              <input className="mt-1 w-full rounded border px-2 py-1.5 font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          ) : null}
          <label className="block">
            Açıklama
            <textarea className="mt-1 w-full rounded border px-2 py-1.5" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block">
            Sıra
            <input type="number" className="mt-1 w-full rounded border px-2 py-1.5" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={trialEnabled} onChange={(e) => setTrialEnabled(e.target.checked)} />
            Trial etkin
          </label>
          <label className="block">
            Trial gün
            <input type="number" className="mt-1 w-full rounded border px-2 py-1.5" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
          </label>
        </div>
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose}>İptal</button>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
            {loading ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
