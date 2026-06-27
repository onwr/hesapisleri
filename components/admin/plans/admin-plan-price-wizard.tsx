"use client";

import { useState } from "react";
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

type Props = {
  open: boolean;
  onClose: () => void;
  planId: string;
  defaultCurrency: string;
  onSuccess: (msg: string) => void;
};

const INTERVALS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;
const POLICIES = [
  "NEW_SUBSCRIBERS_ONLY",
  "NEXT_RENEWAL",
  "AFTER_DATE",
  "GRANDFATHERED",
] as const;

export function AdminPlanPriceWizard({ open, onClose, planId, defaultCurrency, onSuccess }: Props) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [billingInterval, setBillingInterval] = useState<(typeof INTERVALS)[number]>("MONTHLY");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [listPrice, setListPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [vatRate, setVatRate] = useState(20);
  const [vatIncluded, setVatIncluded] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 16));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [priceChangePolicy, setPriceChangePolicy] = useState<(typeof POLICIES)[number]>("NEW_SUBSCRIBERS_ONLY");
  const [isPublic, setIsPublic] = useState(true);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [priceForm, setPriceForm] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  if (!open) return null;

  function buildPayload() {
    return {
      billingInterval,
      currency,
      listPrice,
      salePrice,
      vatRate,
      vatIncluded,
      effectiveFrom: new Date(effectiveFrom).toISOString(),
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      priceChangePolicy,
      isPublic,
    };
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
      setStep("form");
      setPreview(null);
      setReason("");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">
          {step === "form" ? "Yeni fiyat — Adım 1" : "Fiyat önizleme — Adım 2"}
        </h3>

        {step === "form" ? (
          <form onSubmit={handlePreview} className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
            <label>
              Dönem
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={billingInterval} onChange={(e) => setBillingInterval(e.target.value as typeof billingInterval)}>
                {INTERVALS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </label>
            <label>
              Para birimi
              <input className="mt-1 w-full rounded border px-2 py-1.5 font-mono uppercase" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </label>
            <label>
              Liste fiyatı
              <input className="mt-1 w-full rounded border px-2 py-1.5" value={listPrice} onChange={(e) => setListPrice(e.target.value)} required />
            </label>
            <label>
              Satış fiyatı
              <input className="mt-1 w-full rounded border px-2 py-1.5" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
            </label>
            <label>
              KDV %
              <input type="number" className="mt-1 w-full rounded border px-2 py-1.5" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} />
              KDV dahil
            </label>
            <label>
              Başlangıç
              <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1.5" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </label>
            <label>
              Bitiş (opsiyonel)
              <input type="datetime-local" className="mt-1 w-full rounded border px-2 py-1.5" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} />
            </label>
            <label className="sm:col-span-2">
              Fiyat değişim politikası
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={priceChangePolicy} onChange={(e) => setPriceChangePolicy(e.target.value as typeof priceChangePolicy)}>
                {POLICIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public (checkout görünür)
            </label>
            {error ? <p className="sm:col-span-2 text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className={appOutlineButtonClass} onClick={close}>İptal</button>
              <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
                {loading ? "Hesaplanıyor…" : "Önizle"}
              </button>
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
              <textarea className="mt-1 w-full rounded border px-2 py-1.5" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            {error ? <p className="text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={appOutlineButtonClass} onClick={() => setStep("form")}>Geri</button>
              <button type="button" className={appPrimaryButtonClass} disabled={publishing} onClick={handlePublish}>
                {publishing ? "Yayınlanıyor…" : "Yayınla"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
