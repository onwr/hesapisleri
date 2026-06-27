"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { ENTITLEMENT_REGISTRY } from "@/lib/billing/entitlements/entitlement-registry";

type FeatureDraft = {
  title: string;
  shortDescription: string;
  iconKey: string;
  sortOrder: number;
  isHighlighted: boolean;
};

type EntitlementDraft = {
  code: string;
  valueType: "BOOLEAN" | "NUMBER" | "UNLIMITED" | "STRING";
  booleanValue: boolean;
  numberValue: number;
  stringValue: string;
  isUnlimited: boolean;
};

const STEPS = ["Temel", "Özellikler", "Yetkiler", "Özet"] as const;

function newClientRequestId() {
  return `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AdminPlanCreateWizard() {
  const router = useRouter();
  const registry = useMemo(() => Object.values(ENTITLEMENT_REGISTRY), []);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientRequestId] = useState(newClientRequestId);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(100);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState(14);
  const [defaultCurrency, setDefaultCurrency] = useState<"TRY" | "USD" | "EUR">("TRY");
  const [visibility, setVisibility] = useState<"INTERNAL" | "PRIVATE">("INTERNAL");

  const [features, setFeatures] = useState<FeatureDraft[]>([]);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDesc, setFeatureDesc] = useState("");

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [entitlementValues, setEntitlementValues] = useState<Record<string, EntitlementDraft>>({});

  const validateStep = useCallback((): string | null => {
    if (step === 0) {
      if (name.trim().length < 2) return "Plan adı en az 2 karakter olmalıdır.";
      if (code.trim().length < 2) return "Plan kodu en az 2 karakter olmalıdır.";
      if (!/^[a-zA-Z0-9-]+$/.test(code.trim())) {
        return "Plan kodu yalnızca harf, rakam ve tire içerebilir.";
      }
      if (code.trim().toLowerCase() === "standard") return '"standard" ayrılmış plandır.';
      return null;
    }
    if (step === 1) return null;
    if (step === 2) return null;
    return null;
  }, [step, name, code]);

  function toggleEntitlement(code: string) {
    const meta = registry.find((r) => r.code === code);
    if (!meta) return;
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
        setEntitlementValues((vals) => {
          const copy = { ...vals };
          delete copy[code];
          return copy;
        });
      } else {
        next.add(code);
        setEntitlementValues((vals) => ({
          ...vals,
          [code]: {
            code,
            valueType: meta.valueType,
            booleanValue: meta.defaultBehavior === "ALLOW",
            numberValue: 0,
            stringValue: "",
            isUnlimited: meta.valueType === "UNLIMITED",
          },
        }));
      }
      return next;
    });
  }

  function addFeature() {
    const title = featureTitle.trim();
    if (!title) return;
    setFeatures((prev) => [
      ...prev,
      {
        title,
        shortDescription: featureDesc.trim(),
        iconKey: "",
        sortOrder: (prev.length + 1) * 10,
        isHighlighted: false,
      },
    ]);
    setFeatureTitle("");
    setFeatureDesc("");
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const entitlements = [...selectedCodes].map((c) => {
      const v = entitlementValues[c]!;
      return {
        code: c,
        valueType: v.valueType,
        booleanValue: v.valueType === "BOOLEAN" ? v.booleanValue : null,
        numberValue: v.valueType === "NUMBER" ? v.numberValue : null,
        stringValue: v.valueType === "STRING" ? v.stringValue : null,
        isUnlimited: v.valueType === "UNLIMITED" ? true : v.isUnlimited,
        sortOrder: 100,
      };
    });

    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toLowerCase(),
          description: description.trim() || null,
          sortOrder,
          trialEnabled,
          trialDays,
          defaultCurrency,
          visibility,
          features: features.map((f) => ({
            title: f.title,
            shortDescription: f.shortDescription || null,
            iconKey: f.iconKey || null,
            sortOrder: f.sortOrder,
            isHighlighted: f.isHighlighted,
            isVisible: true,
          })),
          entitlements,
          clientRequestId,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Oluşturulamadı");
      router.push(`/admin/plans/${json.data.planId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan oluşturulamadı.");
      setSubmitting(false);
    }
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
    else void handleSubmit();
  }

  function back() {
    setError(null);
    if (step > 0) setStep(step - 1);
  }

  return (
    <AdminPageContainer size="default">
      <AdminPageHeader
        title="Yeni Plan"
        description="Taslak plan oluşturma — fiyatlar pricing sekmesinden eklenir."
        backHref="/admin/plans"
      />

      <div className={`${appPanelClass} mb-4 p-4`}>
        <div className="mb-4 flex gap-2 text-[11px] font-bold text-slate-500">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={i === step ? "text-slate-900" : i < step ? "text-emerald-700" : ""}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-3 text-[12px]">
            <label className="block">
              Plan adı *
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block">
              Kod (benzersiz) *
              <input
                className="mt-1 w-full rounded border px-2 py-1 font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder="ornek-plan"
              />
            </label>
            <label className="block">
              Açıklama
              <textarea
                className="mt-1 w-full rounded border px-2 py-1"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label>
                Sıra
                <input
                  type="number"
                  className="ml-1 w-20 rounded border px-2 py-1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </label>
              <label>
                Para birimi
                <select
                  className="ml-1 rounded border px-2 py-1"
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value as "TRY" | "USD" | "EUR")}
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>
                Görünürlük
                <select
                  className="ml-1 rounded border px-2 py-1"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "INTERNAL" | "PRIVATE")}
                >
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={trialEnabled}
                onChange={(e) => setTrialEnabled(e.target.checked)}
              />
              Trial etkin
            </label>
            {trialEnabled ? (
              <label>
                Trial gün
                <input
                  type="number"
                  className="ml-1 w-20 rounded border px-2 py-1"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3 text-[12px]">
            <p className="text-slate-600">Pazarlama özellikleri (opsiyonel).</p>
            <div className="flex flex-wrap gap-2">
              <input
                className="flex-1 rounded border px-2 py-1"
                placeholder="Özellik başlığı"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
              />
              <input
                className="flex-1 rounded border px-2 py-1"
                placeholder="Kısa açıklama"
                value={featureDesc}
                onChange={(e) => setFeatureDesc(e.target.value)}
              />
              <button type="button" className={appOutlineButtonClass} onClick={addFeature}>
                Ekle
              </button>
            </div>
            {features.length === 0 ? (
              <p className="text-slate-500">Henüz özellik eklenmedi.</p>
            ) : (
              <ul className="list-disc pl-4">
                {features.map((f, i) => (
                  <li key={`${f.title}-${i}`}>
                    {f.title}
                    {f.shortDescription ? ` — ${f.shortDescription}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-2 text-[12px]">
            <p className="text-slate-600">
              Yalnız registry kodları. Operasyonel enforcement kapalı kalır.
            </p>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {registry.map((r) => (
                <label key={r.code} className="flex items-start gap-2 rounded border p-2">
                  <input
                    type="checkbox"
                    checked={selectedCodes.has(r.code)}
                    onChange={() => toggleEntitlement(r.code)}
                  />
                  <span>
                    <span className="font-mono font-bold">{r.code}</span>
                    <span className="ml-2 text-slate-500">{r.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2 text-[12px] text-slate-700">
            <p>
              <strong>{name}</strong> ({code}) — DRAFT / {visibility}
            </p>
            <p>Özellik: {features.length} · Yetki: {selectedCodes.size}</p>
            <p className="text-slate-500">
              Plan checkout&apos;a kapalı oluşturulur. Fiyatlar pricing sekmesinden eklenir.
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}

        <div className="mt-4 flex justify-between gap-2">
          <div>
            {step > 0 ? (
              <button type="button" className={appOutlineButtonClass} onClick={back} disabled={submitting}>
                Geri
              </button>
            ) : (
              <Link href="/admin/plans" className={appOutlineButtonClass}>
                İptal
              </Link>
            )}
          </div>
          <button
            type="button"
            className={appPrimaryButtonClass}
            onClick={next}
            disabled={submitting}
          >
            {submitting ? "Kaydediliyor…" : step === STEPS.length - 1 ? "Taslak oluştur" : "İleri"}
          </button>
        </div>
      </div>
    </AdminPageContainer>
  );
}
