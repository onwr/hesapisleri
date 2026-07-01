"use client";

import { useEffect, useState } from "react";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { formatMoney } from "@/lib/format-utils";

type PreviewData = {
  previewToken: string;
  expiresAt: number;
  current: { salePriceMinor: number; listPriceMinor: number } | null;
  proposed: { salePriceMinor: number; listPriceMinor: number; totalMinor: number };
  diff: { minor: number; percent: number | null; currency: string; interval: string };
  priceChangePolicy: string;
  subscriptionImpact: Record<string, number>;
  mrrEstimatedDelta: Record<string, number>;
  notices: string[];
};

export type AdminPlanPriceWizardInitial = {
  id?: string;
  billingInterval: string;
  currency: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  vatIncluded: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  priceChangePolicy: string;
  isPublic: boolean;
  status?: string;
};

export type AdminPlanPriceWizardMode = "create" | "edit-draft" | "revise";

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  defaultCurrency: string;
  onSuccess: (msg: string) => void;
  mode?: AdminPlanPriceWizardMode;
  priceId?: string;
  initialPrice?: AdminPlanPriceWizardInitial | null;
};

const INTERVALS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;
const INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};
const POLICIES = [
  "NEW_SUBSCRIBERS_ONLY",
  "NEXT_RENEWAL",
  "AFTER_DATE",
  "GRANDFATHERED",
] as const;

function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultFormState(currency: string) {
  return {
    billingInterval: "MONTHLY" as (typeof INTERVALS)[number],
    currency,
    listPrice: "",
    salePrice: "",
    vatRate: 20,
    vatIncluded: false,
    effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveUntil: "",
    priceChangePolicy: "NEW_SUBSCRIBERS_ONLY" as (typeof POLICIES)[number],
    isPublic: true,
    adminNote: "",
  };
}

export function AdminPlanPriceWizard({
  open,
  onClose,
  planId,
  defaultCurrency,
  onSuccess,
  mode = "create",
  priceId,
  initialPrice,
}: Props) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [form, setForm] = useState(() => defaultFormState(defaultCurrency));
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [priceForm, setPriceForm] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [reason, setReason] = useState("");

  const isEditDraft = mode === "edit-draft" && Boolean(priceId);
  const isRevise = mode === "revise";

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setPreview(null);
    setPriceForm(null);
    setError(null);
    setReason("");
    if (initialPrice) {
      setForm({
        billingInterval: initialPrice.billingInterval as (typeof INTERVALS)[number],
        currency: initialPrice.currency,
        listPrice: String(initialPrice.listPrice),
        salePrice: String(initialPrice.salePrice),
        vatRate: initialPrice.vatRate,
        vatIncluded: initialPrice.vatIncluded,
        effectiveFrom: toDatetimeLocalValue(initialPrice.effectiveFrom),
        effectiveUntil: toDatetimeLocalValue(initialPrice.effectiveUntil),
        priceChangePolicy: initialPrice.priceChangePolicy as (typeof POLICIES)[number],
        isPublic: initialPrice.isPublic,
        adminNote: "",
      });
    } else {
      setForm(defaultFormState(defaultCurrency));
    }
  }, [open, initialPrice, defaultCurrency]);

  if (!open) return null;

  function buildPayload() {
    return {
      billingInterval: form.billingInterval,
      currency: form.currency,
      listPrice: form.listPrice,
      salePrice: form.salePrice,
      vatRate: form.vatRate,
      vatIncluded: form.vatIncluded,
      effectiveFrom: new Date(form.effectiveFrom).toISOString(),
      effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null,
      priceChangePolicy: form.priceChangePolicy,
      isPublic: form.isPublic,
      adminNote: form.adminNote.trim() || undefined,
    };
  }

  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!priceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/prices/${priceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Kayıt başarısız");
        return;
      }
      onSuccess(json.message ?? "Fiyat güncellendi.");
      close();
    } catch {
      setError("Kayıt isteği başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishDraft() {
    if (!priceId) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/prices/${priceId}/publish`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Yayınlama başarısız");
        return;
      }
      onSuccess(json.message ?? "Fiyat yayınlandı.");
      close();
    } catch {
      setError("Yayınlama başarısız");
    } finally {
      setPublishing(false);
    }
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = buildPayload();
    try {
      const res = await fetch(`/api/admin/plans/${planId}/prices/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Önizleme başarısız");
        return;
      }
      setPreview(json.data);
      setPriceForm(payload);
      setStep("preview");
    } catch {
      setError("Önizleme isteği başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!preview || !priceForm || !reason.trim()) {
      setError("Yayın için sebep ve geçerli önizleme gerekli.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/plans/${planId}/prices/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken: preview.previewToken,
          reason: reason.trim(),
          price: priceForm,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.code === "PREVIEW_STALE" ? "Önizleme güncel değil; yeniden önizleyin." : json.message);
        return;
      }
      onSuccess(json.message ?? "Fiyat yayınlandı.");
      close();
    } catch {
      setError("Yayınlama başarısız");
    } finally {
      setPublishing(false);
    }
  }

  function close() {
    setStep("form");
    setPreview(null);
    setError(null);
    onClose();
  }

  const title =
    step === "preview"
      ? "Fiyat önizleme"
      : isEditDraft
        ? "Fiyat düzenle"
        : isRevise
          ? "Yeni fiyat versiyonu"
          : "Yeni fiyat";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
        {isRevise ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Aktif fiyat doğrudan değiştirilmez; önizleme sonrası yeni versiyon yayınlanır.
          </p>
        ) : null}

        {step === "form" ? (
          <form
            onSubmit={isEditDraft ? handleSaveDraft : handlePreview}
            className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2"
          >
            <label>
              Dönem
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.billingInterval}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    billingInterval: e.target.value as (typeof INTERVALS)[number],
                  }))
                }
                disabled={isEditDraft}
              >
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>
                    {INTERVAL_LABELS[i] ?? i}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Para birimi
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 font-mono uppercase"
                value={form.currency}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
                }
                maxLength={3}
                disabled={isEditDraft}
              />
            </label>
            <label>
              Liste fiyatı
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.listPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, listPrice: e.target.value }))}
                required
              />
            </label>
            <label>
              Satış fiyatı
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.salePrice}
                onChange={(e) => setForm((prev) => ({ ...prev, salePrice: e.target.value }))}
                required
              />
            </label>
            <label>
              KDV %
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.vatRate}
                onChange={(e) => setForm((prev) => ({ ...prev, vatRate: Number(e.target.value) }))}
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={form.vatIncluded}
                onChange={(e) => setForm((prev) => ({ ...prev, vatIncluded: e.target.checked }))}
              />
              KDV dahil
            </label>
            <label>
              Başlangıç
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.effectiveFrom}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
              />
            </label>
            <label>
              Bitiş (opsiyonel)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.effectiveUntil}
                onChange={(e) => setForm((prev) => ({ ...prev, effectiveUntil: e.target.value }))}
              />
            </label>
            <label className="sm:col-span-2">
              Fiyat değişim politikası
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={form.priceChangePolicy}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priceChangePolicy: e.target.value as (typeof POLICIES)[number],
                  }))
                }
              >
                {POLICIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
              />
              Public (checkout görünür)
            </label>
            {isEditDraft ? (
              <label className="sm:col-span-2">
                Admin notu
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  rows={2}
                  value={form.adminNote}
                  onChange={(e) => setForm((prev) => ({ ...prev, adminNote: e.target.value }))}
                />
              </label>
            ) : null}
            {error ? <p className="sm:col-span-2 text-red-700">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="button" className={appOutlineButtonClass} onClick={close}>
                İptal
              </button>
              {isEditDraft ? (
                <>
                  <button
                    type="button"
                    className={appOutlineButtonClass}
                    disabled={publishing}
                    onClick={handlePublishDraft}
                  >
                    {publishing ? "Yayınlanıyor…" : "Kaydet ve yayınla"}
                  </button>
                  <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
                    {loading ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </>
              ) : (
                <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
                  {loading ? "Hesaplanıyor…" : "Önizle"}
                </button>
              )}
            </div>
          </form>
        ) : preview ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border p-3">
                <p className="font-bold text-slate-800">Mevcut</p>
                <p>{preview.current ? formatMoney(preview.current.salePriceMinor / 100) : "Yok"}</p>
              </div>
              <div className="rounded border p-3">
                <p className="font-bold text-slate-800">Önerilen</p>
                <p>{formatMoney(preview.proposed.salePriceMinor / 100)}</p>
              </div>
            </div>
            <p>
              Fark: {formatMoney(preview.diff.minor / 100)} ({preview.diff.percent ?? "—"}%) ·{" "}
              {preview.diff.interval} / {preview.diff.currency}
            </p>
            <p>Politika: {preview.priceChangePolicy}</p>
            <div className="rounded bg-slate-50 p-3">
              <p className="font-bold">Abonelik etkisi</p>
              <ul className="mt-1 list-inside list-disc">
                <li>Aktif: {preview.subscriptionImpact.activeTotal}</li>
                <li>Kilitli: {preview.subscriptionImpact.withPriceLock}</li>
                <li>Kilitsiz: {preview.subscriptionImpact.withoutPriceLock}</li>
                <li>Sonraki yenileme: {preview.subscriptionImpact.nextRenewalPlanned}</li>
                <li>Grandfathered: {preview.subscriptionImpact.grandfathered}</li>
              </ul>
            </div>
            <ul className="list-inside list-disc text-slate-600">
              {preview.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <label className="block">
              Yayın sebebi (zorunlu)
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            {error ? <p className="text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setStep("form")}>
                Geri
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={publishing}
                onClick={handlePublish}
              >
                {publishing ? "Yayınlanıyor…" : "Yayınla"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
