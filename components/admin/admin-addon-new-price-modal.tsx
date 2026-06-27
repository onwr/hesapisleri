"use client";

import { useState } from "react";
import { adminAddonPriceCreateSchema } from "@/lib/admin/addons/admin-addon-schemas";
import { calculateVatBreakdown, formatMinorToMoney, parseMoneyToMinor } from "@/lib/billing/pricing-utils";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type CreatedPrice = {
  id: string;
  version: number;
  billingInterval: string | null;
  listPriceMinor: number;
  salePriceMinor: number;
  currency: string;
  vatRate: number;
  vatIncluded: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  addOnId: string;
  addOnType: string;
  defaultCurrency: string;
  defaultVatRate: number;
  defaultVatIncluded: boolean;
  isArchived: boolean;
  onSuccess: (msg: string) => void;
};

const INTERVALS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;

export function AdminAddonNewPriceModal({
  open,
  onClose,
  addOnId,
  addOnType,
  defaultCurrency,
  defaultVatRate,
  defaultVatIncluded,
  isArchived,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [billingInterval, setBillingInterval] = useState<(typeof INTERVALS)[number]>("MONTHLY");
  const [listPrice, setListPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [vatRate, setVatRate] = useState(defaultVatRate);
  const [vatIncluded, setVatIncluded] = useState(defaultVatIncluded);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 16));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [reason, setReason] = useState("");
  const [draftPrice, setDraftPrice] = useState<CreatedPrice | null>(null);
  const [overlapMessage, setOverlapMessage] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function resetAndClose() {
    setStep("form");
    setDraftPrice(null);
    setOverlapMessage(null);
    setError(null);
    setReason("");
    onClose();
  }

  function buildApiPayload() {
    let listPriceMinor: number;
    let salePriceMinor: number;
    try {
      listPriceMinor = parseMoneyToMinor(listPrice);
      salePriceMinor = parseMoneyToMinor(salePrice);
    } catch {
      throw new Error("Geçersiz para tutarı.");
    }
    if (listPriceMinor < 0 || salePriceMinor < 0) {
      throw new Error("Fiyat negatif olamaz.");
    }

    const fromIso = new Date(effectiveFrom).toISOString();
    const untilIso = effectiveUntil ? new Date(effectiveUntil).toISOString() : null;
    if (untilIso && new Date(untilIso) <= new Date(fromIso)) {
      throw new Error("Bitiş tarihi başlangıçtan sonra olmalıdır.");
    }

    return adminAddonPriceCreateSchema.parse({
      billingInterval: addOnType === "RECURRING" ? billingInterval : null,
      currency: defaultCurrency,
      listPriceMinor,
      salePriceMinor,
      vatRate,
      vatIncluded,
      effectiveFrom: fromIso,
      effectiveUntil: untilIso,
      reason: reason.trim() || undefined,
    });
  }

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    if (validating || isArchived) return;
    setValidating(true);
    setError(null);
    setOverlapMessage(null);

    try {
      const payload = buildApiPayload();
      const res = await fetch(`/api/admin/add-ons/${addOnId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        if (res.status === 409) {
          setOverlapMessage(json.message ?? "Fiyat tarih aralığı çakışıyor.");
        } else {
          setError(json.message ?? "Sunucu doğrulaması başarısız.");
        }
        return;
      }
      setDraftPrice(json.data as CreatedPrice);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama başarısız.");
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    if (!draftPrice || publishing || isArchived) return;
    if (!reason.trim()) {
      setError("Yayın için sebep zorunludur.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/add-ons/${addOnId}/prices/${draftPrice.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim(), confirm: true }),
        }
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Yayınlama başarısız.");
        return;
      }
      onSuccess(json.message ?? "Fiyat yayınlandı.");
      setStep("form");
      setDraftPrice(null);
      setListPrice("");
      setSalePrice("");
      setReason("");
    } catch {
      setError("Yayınlama isteği başarısız.");
    } finally {
      setPublishing(false);
    }
  }

  const vatPreview = draftPrice
    ? calculateVatBreakdown({
        salePriceMinor: draftPrice.salePriceMinor,
        vatRate: draftPrice.vatRate,
        vatIncluded: draftPrice.vatIncluded,
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-[14px] font-bold text-slate-900">
          {step === "form" ? "Yeni fiyat" : "Fiyat onayı"}
        </h3>

        {isArchived ? (
          <p className="mt-3 text-[12px] text-red-700">
            Arşivlenmiş add-on için yeni fiyat oluşturulamaz.
          </p>
        ) : null}

        {step === "form" ? (
          <form onSubmit={handleValidate} className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
            {addOnType === "RECURRING" ? (
              <label>
                Fatura dönemi
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value as (typeof INTERVALS)[number])}
                >
                  {INTERVALS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-slate-500 sm:col-span-2">Tek seferlik / kullanım paketi — dönem yok</p>
            )}
            <label>
              Para birimi
              <input
                className="mt-1 w-full rounded border bg-slate-50 px-2 py-1.5 font-mono uppercase"
                value={defaultCurrency}
                readOnly
              />
            </label>
            <label>
              Liste fiyatı
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            <label>
              Satış fiyatı
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0,00"
                required
              />
            </label>
            <label>
              KDV %
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={vatIncluded}
                onChange={(e) => setVatIncluded(e.target.checked)}
              />
              KDV dahil
            </label>
            <label>
              Geçerlilik başlangıcı
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </label>
            <label>
              Geçerlilik bitişi (opsiyonel)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={effectiveUntil}
                onChange={(e) => setEffectiveUntil(e.target.value)}
              />
            </label>
            {overlapMessage ? (
              <p className="sm:col-span-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                Çakışma: {overlapMessage}
              </p>
            ) : null}
            {error ? <p className="sm:col-span-2 text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className={appOutlineButtonClass} onClick={resetAndClose}>
                İptal
              </button>
              <button
                type="submit"
                className={appPrimaryButtonClass}
                disabled={validating || isArchived}
              >
                {validating ? "Doğrulanıyor…" : "Doğrula ve önizle"}
              </button>
            </div>
          </form>
        ) : draftPrice ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <p className="rounded border border-emerald-100 bg-emerald-50 p-3 text-emerald-900">
              Taslak fiyat oluşturuldu (v{draftPrice.version}). Yayınlamadan önce bilgileri kontrol edin.
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Dönem</dt>
                <dd className="font-semibold">{draftPrice.billingInterval ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Para birimi</dt>
                <dd className="font-semibold">{draftPrice.currency}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Liste</dt>
                <dd className="font-semibold">
                  {formatMinorToMoney(draftPrice.listPriceMinor, draftPrice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Satış</dt>
                <dd className="font-semibold">
                  {formatMinorToMoney(draftPrice.salePriceMinor, draftPrice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Başlangıç</dt>
                <dd className="font-semibold">{formatAdminDateTime(draftPrice.effectiveFrom)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Bitiş</dt>
                <dd className="font-semibold">
                  {draftPrice.effectiveUntil
                    ? formatAdminDateTime(draftPrice.effectiveUntil)
                    : "Süresiz"}
                </dd>
              </div>
            </dl>
            {vatPreview ? (
              <div className="rounded bg-slate-50 p-3">
                <p className="font-bold text-slate-800">KDV dökümü (sunucu)</p>
                <p>Ara toplam: {formatMinorToMoney(vatPreview.subtotalMinor, draftPrice.currency)}</p>
                <p>KDV: {formatMinorToMoney(vatPreview.vatMinor, draftPrice.currency)}</p>
                <p>Toplam: {formatMinorToMoney(vatPreview.totalMinor, draftPrice.currency)}</p>
              </div>
            ) : null}
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
              <button
                type="button"
                className={appOutlineButtonClass}
                onClick={() => {
                  setStep("form");
                  setDraftPrice(null);
                  setError(null);
                }}
                disabled={publishing}
              >
                Geri
              </button>
              <button
                type="button"
                className={appPrimaryButtonClass}
                disabled={publishing || isArchived}
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
