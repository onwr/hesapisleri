"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPlanInfoTip } from "@/components/admin/plans/admin-plan-info-tip";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import {
  ADMIN_PRICE_POLICY_OPTIONS,
  getPricePolicyLabel,
} from "@/lib/admin/plans/admin-plan-price-policy-labels";
import { formatMoney } from "@/lib/format-utils";

type PreviewData = {
  expectedCurrentPriceId: string | null;
  expiresAt: number;
  current: { salePriceMinor: number; listPriceMinor: number } | null;
  proposed: { salePriceMinor: number; listPriceMinor: number; totalMinor: number };
  diff: { minor: number; percent: number | null; currency: string; interval: string };
  priceChangePolicy: string;
  priceChangePolicyLabel: string;
  effectiveFrom: string;
  subscriptionImpact: Record<string, number>;
  mrrEstimatedDelta: Record<string, number>;
  affectsExistingSubscribers: boolean;
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

type WizardStep = "price" | "policy" | "schedule" | "preview";

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
    priceChangePolicy: "NEW_SUBSCRIBERS_ONLY" as (typeof ADMIN_PRICE_POLICY_OPTIONS)[number]["value"],
    isPublic: true,
    adminNote: "",
    scheduleMode: "immediate" as "immediate" | "scheduled",
  };
}

function calcDiff(currentMinor: number | null, nextValue: string) {
  const next = Number(nextValue);
  if (!Number.isFinite(next) || currentMinor == null) return null;
  const nextMinor = Math.round(next * 100);
  const diffMinor = nextMinor - currentMinor;
  const percent =
    currentMinor > 0 ? Math.round((diffMinor / currentMinor) * 1000) / 10 : null;
  return { diffMinor, percent, nextMinor };
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
  const [step, setStep] = useState<WizardStep>("price");
  const [form, setForm] = useState(() => defaultFormState(defaultCurrency));
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [priceForm, setPriceForm] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [reason, setReason] = useState("");
  const [riskConfirmed, setRiskConfirmed] = useState(false);

  const isEditDraft = mode === "edit-draft" && Boolean(priceId);
  const isRevise = mode === "revise";

  const currentSaleMinor = useMemo(() => {
    if (!initialPrice) return null;
    return Math.round(initialPrice.salePrice * 100);
  }, [initialPrice]);

  const saleDiff = useMemo(
    () => calcDiff(currentSaleMinor, form.salePrice),
    [currentSaleMinor, form.salePrice]
  );

  useEffect(() => {
    if (!open) return;
    setStep("price");
    setPreview(null);
    setPriceForm(null);
    setError(null);
    setReason("");
    setRiskConfirmed(false);
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
        priceChangePolicy: initialPrice.priceChangePolicy as (typeof ADMIN_PRICE_POLICY_OPTIONS)[number]["value"],
        isPublic: initialPrice.isPublic,
        adminNote: "",
        scheduleMode: "immediate",
      });
    } else {
      setForm(defaultFormState(defaultCurrency));
    }
  }, [open, initialPrice, defaultCurrency]);

  if (!open) return null;

  function buildPayload() {
    const effectiveFrom =
      form.scheduleMode === "immediate"
        ? new Date().toISOString()
        : new Date(form.effectiveFrom).toISOString();

    return {
      billingInterval: form.billingInterval,
      currency: form.currency,
      listPrice: form.listPrice,
      salePrice: form.salePrice,
      vatRate: form.vatRate,
      vatIncluded: form.vatIncluded,
      effectiveFrom,
      effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null,
      priceChangePolicy: form.priceChangePolicy,
      isPublic: form.isPublic,
      adminNote: form.adminNote.trim() || undefined,
    };
  }

  function close() {
    setStep("price");
    setPreview(null);
    setError(null);
    onClose();
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

  async function runPreview() {
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
        setError(json.message ?? "Fiyat önizlemesi hazırlanamadı. Girdiğiniz değerleri kontrol edin.");
        return;
      }
      setPreview(json.data);
      setPriceForm(payload);
      setStep("preview");
    } catch {
      setError("Fiyat önizlemesi hazırlanamadı. Girdiğiniz değerleri kontrol edin.");
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
          expectedCurrentPriceId: preview.expectedCurrentPriceId,
          reason: reason.trim(),
          price: priceForm,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(
          json.code === "PREVIEW_STALE"
            ? "Önizleme güncel değil; yeniden önizleyin."
            : json.message
        );
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

  const title =
    step === "preview"
      ? "Fiyat önizleme"
      : isEditDraft
        ? "Fiyat düzenle"
        : isRevise
          ? "Fiyatı Değiştir"
          : "Yeni fiyat";

  const stepIndex = step === "price" ? 1 : step === "policy" ? 2 : step === "schedule" ? 3 : 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
        {!isEditDraft ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Adım {Math.min(stepIndex, 3)}/3
            {step === "preview" ? " · Onay" : ""}
          </p>
        ) : null}

        {step === "price" ? (
          <form
            onSubmit={isEditDraft ? handleSaveDraft : (e) => { e.preventDefault(); setStep("policy"); }}
            className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2"
          >
            {isRevise && initialPrice ? (
              <div className="sm:col-span-2 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="font-bold text-slate-800">
                  Mevcut {INTERVAL_LABELS[initialPrice.billingInterval] ?? initialPrice.billingInterval} fiyat
                  <AdminPlanInfoTip text="Şu anda satın alma ekranında kullanılan fiyattır." className="ml-1" />
                </p>
                <p className="mt-1 text-[13px] font-semibold text-slate-900">
                  {formatMoney(initialPrice.salePrice)} {initialPrice.currency}
                </p>
              </div>
            ) : null}

            <label>
              Dönem
              <select
                className="mt-1 h-9 w-full rounded border px-2"
                value={form.billingInterval}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    billingInterval: e.target.value as (typeof INTERVALS)[number],
                  }))
                }
                disabled={isEditDraft || isRevise}
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
                className="mt-1 h-9 w-full rounded border px-2 font-mono uppercase"
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
                className="mt-1 h-9 w-full rounded border px-2"
                value={form.listPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, listPrice: e.target.value }))}
                required
              />
            </label>
            <label>
              Yeni satış fiyatı
              <input
                className="mt-1 h-9 w-full rounded border px-2"
                value={form.salePrice}
                onChange={(e) => setForm((prev) => ({ ...prev, salePrice: e.target.value }))}
                required
              />
            </label>

            {saleDiff && currentSaleMinor != null ? (
              <div className="sm:col-span-2 rounded border border-slate-200 p-2 text-[11px]">
                <span className="font-bold text-slate-700">Fark: </span>
                <span className={saleDiff.diffMinor >= 0 ? "text-red-700" : "text-emerald-700"}>
                  {saleDiff.diffMinor >= 0 ? "+" : ""}
                  {formatMoney(saleDiff.diffMinor / 100)} ({saleDiff.percent ?? "—"}%)
                </span>
                <span className="ml-2 text-slate-500">
                  {saleDiff.diffMinor > 0 ? "Artış" : saleDiff.diffMinor < 0 ? "Azalış" : "Değişim yok"}
                </span>
              </div>
            ) : null}

            <label>
              KDV %
              <input
                type="number"
                className="mt-1 h-9 w-full rounded border px-2"
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

            {isEditDraft ? (
              <>
                <label>
                  Başlangıç
                  <input
                    type="datetime-local"
                    className="mt-1 h-9 w-full rounded border px-2"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                  />
                </label>
                <label>
                  Bitiş (opsiyonel)
                  <input
                    type="datetime-local"
                    className="mt-1 h-9 w-full rounded border px-2"
                    value={form.effectiveUntil}
                    onChange={(e) => setForm((prev) => ({ ...prev, effectiveUntil: e.target.value }))}
                  />
                </label>
                <label className="sm:col-span-2">
                  Admin notu
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    rows={2}
                    value={form.adminNote}
                    onChange={(e) => setForm((prev) => ({ ...prev, adminNote: e.target.value }))}
                  />
                </label>
              </>
            ) : null}

            {error ? <p className="sm:col-span-2 text-red-700">{error}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <button type="button" className={`${appOutlineButtonClass} h-9`} onClick={close}>
                İptal
              </button>
              {isEditDraft ? (
                <>
                  <button
                    type="button"
                    className={`${appOutlineButtonClass} h-9`}
                    disabled={publishing}
                    onClick={handlePublishDraft}
                  >
                    {publishing ? "Yayınlanıyor…" : "Kaydet ve yayınla"}
                  </button>
                  <button type="submit" className={`${appPrimaryButtonClass} h-9`} disabled={loading}>
                    {loading ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </>
              ) : (
                <button type="submit" className={`${appPrimaryButtonClass} h-9`}>
                  Devam
                </button>
              )}
            </div>
          </form>
        ) : null}

        {step === "policy" ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <h4 className="font-bold text-slate-900">Bu fiyat kimlere uygulanacak?</h4>
            <div className="space-y-2">
              {ADMIN_PRICE_POLICY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={[
                    "block cursor-pointer rounded-lg border p-3",
                    form.priceChangePolicy === opt.value
                      ? "border-slate-800 bg-slate-50"
                      : "border-slate-200",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="policy"
                      checked={form.priceChangePolicy === opt.value}
                      onChange={() =>
                        setForm((prev) => ({ ...prev, priceChangePolicy: opt.value }))
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-bold text-slate-900">
                        {opt.title}
                        {opt.recommended ? (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            Önerilen
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">{opt.description}</p>
                      {opt.risky ? (
                        <p className="mt-1 text-[10px] font-bold text-red-700">
                          Bu seçenek mevcut aboneleri doğrudan etkileyebilir.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {error ? <p className="text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={`${appOutlineButtonClass} h-9`} onClick={() => setStep("price")}>
                Geri
              </button>
              <button type="button" className={`${appPrimaryButtonClass} h-9`} onClick={() => setStep("schedule")}>
                Devam
              </button>
            </div>
          </div>
        ) : null}

        {step === "schedule" ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <h4 className="font-bold text-slate-900">Ne zaman geçerli olacak?</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded border p-2">
                <input
                  type="radio"
                  checked={form.scheduleMode === "immediate"}
                  onChange={() => setForm((prev) => ({ ...prev, scheduleMode: "immediate" }))}
                />
                Hemen
              </label>
              <label className="flex items-center gap-2 rounded border p-2">
                <input
                  type="radio"
                  checked={form.scheduleMode === "scheduled"}
                  onChange={() => setForm((prev) => ({ ...prev, scheduleMode: "scheduled" }))}
                />
                Belirli bir tarihte
              </label>
            </div>
            {form.scheduleMode === "scheduled" ? (
              <label className="block">
                Başlangıç tarihi ve saat
                <input
                  type="datetime-local"
                  className="mt-1 h-9 w-full rounded border px-2"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                  required
                />
              </label>
            ) : null}

            {form.priceChangePolicy === "AFTER_DATE" ? (
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <p className="font-bold text-red-800">Dikkat: Mevcut aboneler etkilenebilir</p>
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={riskConfirmed}
                    onChange={(e) => setRiskConfirmed(e.target.checked)}
                  />
                  Bu değişikliğin mevcut abonelere uygulanacağını onaylıyorum.
                </label>
              </div>
            ) : null}

            <div className="rounded bg-slate-50 p-3 text-[11px]">
              <p className="font-bold text-slate-800">Etki özeti</p>
              <ul className="mt-1 list-inside list-disc text-slate-600">
                <li>Politika: {getPricePolicyLabel(form.priceChangePolicy)}</li>
                <li>
                  Başlangıç:{" "}
                  {form.scheduleMode === "immediate"
                    ? "Hemen"
                    : new Date(form.effectiveFrom).toLocaleString("tr-TR")}
                </li>
                <li>
                  Mevcut aboneler:{" "}
                  {form.priceChangePolicy === "NEW_SUBSCRIBERS_ONLY"
                    ? "Etkilenmez"
                    : "Yenileme/tarih politikasına göre etkilenir"}
                </li>
              </ul>
            </div>

            {error ? <p className="text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className={`${appOutlineButtonClass} h-9`} onClick={() => setStep("policy")}>
                Geri
              </button>
              <button
                type="button"
                className={`${appPrimaryButtonClass} h-9`}
                disabled={
                  loading ||
                  (form.priceChangePolicy === "AFTER_DATE" && !riskConfirmed)
                }
                onClick={() => void runPreview()}
              >
                {loading ? "Hesaplanıyor…" : "Önizle"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "preview" && preview ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Satın alma kartı önizlemesi
              </p>
              <p className="mt-2 text-[16px] font-bold text-slate-900">
                {formatMoney(preview.proposed.salePriceMinor / 100)}{" "}
                <span className="text-[12px] font-normal text-slate-500">
                  / {INTERVAL_LABELS[preview.diff.interval] ?? preview.diff.interval}
                </span>
              </p>
              {preview.current ? (
                <p className="text-[12px] text-slate-400 line-through">
                  {formatMoney(preview.current.salePriceMinor / 100)}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-slate-600">
                Geçerlilik: {new Date(preview.effectiveFrom).toLocaleString("tr-TR")}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border p-3">
                <p className="font-bold text-slate-800">Mevcut</p>
                <p>{preview.current ? formatMoney(preview.current.salePriceMinor / 100) : "Yok"}</p>
              </div>
              <div className="rounded border p-3">
                <p className="font-bold text-slate-800">Yeni</p>
                <p>{formatMoney(preview.proposed.salePriceMinor / 100)}</p>
              </div>
            </div>
            <p>
              Fark: {formatMoney(preview.diff.minor / 100)} ({preview.diff.percent ?? "—"}%)
            </p>
            <p>Politika: {preview.priceChangePolicyLabel}</p>

            <div className="rounded bg-slate-50 p-3">
              <p className="font-bold">Yönetici etki özeti</p>
              <ul className="mt-1 list-inside list-disc">
                <li>Aktif abone: {preview.subscriptionImpact.activeTotal}</li>
                <li>
                  Mevcut aboneler etkilenir mi:{" "}
                  {preview.affectsExistingSubscribers ? "Evet" : "Hayır"}
                </li>
                <li>
                  Tahmini MRR farkı:{" "}
                  {Object.entries(preview.mrrEstimatedDelta)
                    .map(([c, v]) => `${v.toLocaleString("tr-TR")} ${c}`)
                    .join(" · ") || "0"}
                </li>
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
              <button type="button" className={`${appOutlineButtonClass} h-9`} onClick={() => setStep("schedule")}>
                Geri
              </button>
              <button
                type="button"
                className={`${appPrimaryButtonClass} h-9`}
                disabled={publishing}
                onClick={handlePublish}
              >
                {publishing ? "Yayınlanıyor…" : "Fiyatı uygula"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
