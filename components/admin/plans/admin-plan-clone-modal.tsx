"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  sourceName: string;
  onSuccess: (msg: string) => void;
};

export function AdminPlanCloneModal({ open, onClose, planId, sourceName, onSuccess }: Props) {
  const router = useRouter();
  const [name, setName] = useState(`${sourceName} (Kopya)`);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [copyFeatures, setCopyFeatures] = useState(true);
  const [copyEntitlements, setCopyEntitlements] = useState(true);
  const [copyPricesAsDraft, setCopyPricesAsDraft] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const confirmOk = confirmText.trim().toUpperCase() === "KOPYALA";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !confirmOk) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/plans/${planId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toLowerCase(),
          description: description.trim() || null,
          copyFeatures,
          copyEntitlements,
          copyPricesAsDraft,
          reason: reason.trim(),
          confirm: true,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Kopyalanamadı");
      onSuccess("Plan kopyalandı.");
      onClose();
      router.push(`/admin/plans/${json.data.planId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan kopyalanamadı.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg text-[12px]"
      >
        <h2 className="mb-2 text-[14px] font-bold text-slate-900">Planı Kopyala</h2>
        <p className="mb-3 text-slate-600">Kaynak: {sourceName}</p>

        <label className="mb-2 block">
          Yeni plan adı *
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="mb-2 block">
          Yeni kod *
          <input
            className="mt-1 w-full rounded border px-2 py-1 font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            required
            placeholder="yeni-plan-kodu"
          />
        </label>
        <label className="mb-2 block">
          Açıklama
          <textarea
            className="mt-1 w-full rounded border px-2 py-1"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="mb-2 space-y-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyFeatures}
              onChange={(e) => setCopyFeatures(e.target.checked)}
            />
            Özellikleri kopyala
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyEntitlements}
              onChange={(e) => setCopyEntitlements(e.target.checked)}
            />
            Yetkileri kopyala
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyPricesAsDraft}
              onChange={(e) => setCopyPricesAsDraft(e.target.checked)}
            />
            Fiyatları taslak olarak kopyala
          </label>
        </div>

        <label className="mb-2 block">
          Sebep *
          <textarea
            className="mt-1 w-full rounded border px-2 py-1"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <label className="mb-2 block">
          Onay için <strong>KOPYALA</strong> yazın
          <input
            className="mt-1 w-full rounded border px-2 py-1 font-mono"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="KOPYALA"
          />
        </label>

        {error ? <p className="mb-2 text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose} disabled={submitting}>
            İptal
          </button>
          <button
            type="submit"
            className={appPrimaryButtonClass}
            disabled={submitting || !confirmOk || reason.trim().length < 1}
          >
            {submitting ? "Kopyalanıyor…" : "Planı kopyala"}
          </button>
        </div>
      </form>
    </div>
  );
}
