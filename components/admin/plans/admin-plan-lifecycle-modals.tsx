"use client";

import { useState } from "react";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

export function AdminPlanActivateModal({
  open,
  onClose,
  planId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  planId: string;
  onSuccess: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) {
      setError("Onay kutusunu işaretleyin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirm: true }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      onSuccess(json.message ?? "Plan aktifleştirildi.");
    } catch {
      setError("İstek başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">Planı aktif et</h3>
        <p className="mt-2 text-[12px] text-slate-600">
          Engelleyici fiyat sorunları varsa aktivasyon reddedilir. Checkout görünürlüğü ayrıca
          visibility ve standard plan kurallarına bağlıdır.
        </p>
        <label className="mt-4 block text-[12px]">
          Sebep
          <textarea className="mt-1 w-full rounded border px-2 py-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          Planı aktifleştirmeyi onaylıyorum
        </label>
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose}>İptal</button>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
            {loading ? "Aktifleştiriliyor…" : "Aktif et"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminPlanArchiveModal({
  open,
  onClose,
  planId,
  activeCount,
  trialCount,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  planId: string;
  activeCount: number;
  trialCount: number;
  onSuccess: (msg: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [confirmSubs, setConfirmSubs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const hasSubs = activeCount + trialCount > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) {
      setError("Onay kutusunu işaretleyin.");
      return;
    }
    if (hasSubs && !confirmSubs) {
      setError("Aktif abonelik uyarısını onaylayın.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          confirm: true,
          confirmActiveSubscriptions: hasSubs ? confirmSubs : false,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
        return;
      }
      onSuccess(json.message ?? "Plan arşivlendi.");
    } catch {
      setError("İstek başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">Planı arşivle</h3>
        <p className="mt-2 text-[12px] text-slate-600">
          Yeni satışa kapanır; mevcut abonelikler ve ödeme snapshot’ları korunur.
        </p>
        {hasSubs ? (
          <p className="mt-2 rounded bg-amber-50 p-2 text-[12px] text-amber-900">
            {activeCount} aktif + {trialCount} trial abonelik devam edecek. Otomatik iptal yapılmaz.
          </p>
        ) : null}
        <label className="mt-4 block text-[12px]">
          Sebep
          <textarea className="mt-1 w-full rounded border px-2 py-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          Arşivlemeyi onaylıyorum
        </label>
        {hasSubs ? (
          <label className="mt-2 flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={confirmSubs} onChange={(e) => setConfirmSubs(e.target.checked)} />
            Aktif aboneliklerin devam edeceğini anlıyorum
          </label>
        ) : null}
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose}>İptal</button>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
            {loading ? "Arşivleniyor…" : "Arşivle"}
          </button>
        </div>
      </form>
    </div>
  );
}
