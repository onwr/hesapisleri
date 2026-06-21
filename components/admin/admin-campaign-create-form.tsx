"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import type { CampaignConflict } from "@/lib/admin/promotions/promotion-types";
import {
  formatCampaignScopeSummary,
  formatDiscountLabel,
  formatIntervalLabel,
} from "@/lib/admin/promotions/promotion-scope-utils";
import { getConflictSeverityClass } from "@/lib/admin/promotions/promotion-filter-utils";
import type { MembershipPeriod } from "@prisma/client";

type Plan = { id: string; name: string };

const STEPS = [
  "Temel Bilgiler",
  "İndirim",
  "Kapsam",
  "Kullanım Kuralları",
  "Zamanlama",
  "Önizleme",
] as const;

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

type FormState = {
  name: string;
  code: string;
  description: string;
  internalNote: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "OVERRIDE_PRICE";
  discountValue: number;
  overridePriceMinor: number | null;
  minimumAmountMinor: number | null;
  currency: string;
  allPlans: boolean;
  planIds: string[];
  allIntervals: boolean;
  intervals: MembershipPeriod[];
  newCustomersOnly: boolean;
  existingCustomersAllowed: boolean;
  firstPaymentOnly: boolean;
  renewalAllowed: boolean;
  autoApply: boolean;
  stackable: boolean;
  priority: number;
  maxRedemptions: number | null;
  maxRedemptionsPerCompany: number | null;
  startsAt: string;
  endsAt: string;
  publish: boolean;
};

const initialForm: FormState = {
  name: "",
  code: "",
  description: "",
  internalNote: "",
  discountType: "PERCENTAGE",
  discountValue: 10,
  overridePriceMinor: null,
  minimumAmountMinor: null,
  currency: "TRY",
  allPlans: true,
  planIds: [],
  allIntervals: true,
  intervals: [],
  newCustomersOnly: false,
  existingCustomersAllowed: true,
  firstPaymentOnly: false,
  renewalAllowed: true,
  autoApply: false,
  stackable: false,
  priority: 100,
  maxRedemptions: null,
  maxRedemptionsPerCompany: null,
  startsAt: new Date().toISOString().slice(0, 16),
  endsAt: "",
  publish: false,
};

export function AdminCampaignCreateForm({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<CampaignConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);

  const scopes = useMemo(() => buildScopes(form), [form]);

  const hasBlocking = conflicts.some((c) => c.severity === "BLOCKING");

  useEffect(() => {
    if (step !== 5) return;
    let cancelled = false;

    async function loadConflicts() {
      setConflictsLoading(true);
      try {
        const res = await fetch("/api/admin/membership-campaigns/preview-conflicts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discountType: form.discountType,
            priority: form.priority,
            autoApply: form.autoApply,
            stackable: form.stackable,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            scopes,
          }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) setConflicts(json.data?.conflicts ?? []);
      } finally {
        if (!cancelled) setConflictsLoading(false);
      }
    }

    loadConflicts();
    return () => {
      cancelled = true;
    };
  }, [step, form, scopes]);

  function validateStep(current: number) {
    if (current === 0 && form.name.trim().length < 2) {
      setError("Kampanya adı en az 2 karakter olmalıdır.");
      return false;
    }
    if (current === 1 && form.discountValue <= 0) {
      setError("İndirim değeri sıfırdan büyük olmalıdır.");
      return false;
    }
    if (current === 4 && !form.startsAt) {
      setError("Başlangıç tarihi zorunludur.");
      return false;
    }
    setError(null);
    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleSubmit(publish: boolean) {
    if (hasBlocking && publish) {
      setError("Engelleyici çakışmalar giderilmeden yayınlanamaz.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/membership-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code || null,
          description: form.description || null,
          internalNote: form.internalNote || null,
          discountType: form.discountType,
          discountValue: form.discountValue,
          overridePriceMinor: form.overridePriceMinor,
          minimumAmountMinor: form.minimumAmountMinor,
          currency: form.currency,
          newCustomersOnly: form.newCustomersOnly,
          existingCustomersAllowed: form.existingCustomersAllowed,
          firstPaymentOnly: form.firstPaymentOnly,
          renewalAllowed: form.renewalAllowed,
          autoApply: form.autoApply,
          stackable: form.stackable,
          priority: form.priority,
          maxRedemptions: form.maxRedemptions,
          maxRedemptionsPerCompany: form.maxRedemptionsPerCompany,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
          scopes,
          publish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Kampanya oluşturulamadı.");
      router.push(`/admin/membership-campaigns/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageContainer size="default">
      <AdminPageHeader
        title="Yeni Kampanya"
        description="Adım adım kampanya oluşturun ve yayınlayın."
        backHref="/admin/membership-campaigns"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index <= step && setStep(index)}
            className={`rounded-2xl px-3 py-1.5 text-[12px] font-bold ${
              index === step
                ? "bg-blue-600 text-white"
                : index < step
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      <div className={`${appPanelClass} space-y-4 p-5`}>
        {step === 0 && (
          <>
            <Field label="Kampanya Adı *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={appInputClass}
              />
            </Field>
            <Field label="Kod (opsiyonel)">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={appInputClass}
              />
            </Field>
            <Field label="Açıklama">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`${appInputClass} min-h-24`}
              />
            </Field>
            <Field label="İç Not">
              <textarea
                value={form.internalNote}
                onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
                className={`${appInputClass} min-h-20`}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="İndirim Tipi">
                <select
                  value={form.discountType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discountType: e.target.value as FormState["discountType"],
                    })
                  }
                  className={appSelectClass}
                >
                  <option value="PERCENTAGE">Yüzde</option>
                  <option value="FIXED_AMOUNT">Sabit Tutar</option>
                  <option value="OVERRIDE_PRICE">Fiyat Override</option>
                </select>
              </Field>
              <Field label="Değer (kuruş veya %)">
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) =>
                    setForm({ ...form, discountValue: Number(e.target.value) })
                  }
                  className={appInputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum Tutar (kuruş)">
                <input
                  type="number"
                  value={form.minimumAmountMinor ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      minimumAmountMinor: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={appInputClass}
                />
              </Field>
              <Field label="Para Birimi">
                <input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className={appInputClass}
                />
              </Field>
            </div>
            <div className={`rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px]`}>
              <p className="font-bold text-[#0f1f4d]">Örnek Hesaplama</p>
              <p className="mt-1 text-slate-600">
                {formatDiscountLabel(form.discountType, form.discountValue, formatMinorToMoney)}{" "}
                indirim uygulanır.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.allPlans}
                onChange={(e) => setForm({ ...form, allPlans: e.target.checked, planIds: [] })}
              />
              Tüm planlar
            </label>
            {!form.allPlans ? (
              <div className="flex flex-wrap gap-2">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      checked={form.planIds.includes(plan.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.planIds, plan.id]
                          : form.planIds.filter((id) => id !== plan.id);
                        setForm({ ...form, planIds: next });
                      }}
                    />
                    {plan.name}
                  </label>
                ))}
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.allIntervals}
                onChange={(e) =>
                  setForm({ ...form, allIntervals: e.target.checked, intervals: [] })
                }
              />
              Tüm dönemler
            </label>
            {!form.allIntervals ? (
              <div className="flex flex-wrap gap-2">
                {INTERVALS.map((interval) => (
                  <label
                    key={interval}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
                  >
                    <input
                      type="checkbox"
                      checked={form.intervals.includes(interval)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.intervals, interval]
                          : form.intervals.filter((i) => i !== interval);
                        setForm({ ...form, intervals: next });
                      }}
                    />
                    {formatIntervalLabel(interval)}
                  </label>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label="Yalnız yeni müşteriler"
                checked={form.newCustomersOnly}
                onChange={(v) => setForm({ ...form, newCustomersOnly: v })}
              />
              <Toggle
                label="Mevcut müşterilere izin ver"
                checked={form.existingCustomersAllowed}
                onChange={(v) => setForm({ ...form, existingCustomersAllowed: v })}
              />
              <Toggle
                label="Yalnız ilk ödeme"
                checked={form.firstPaymentOnly}
                onChange={(v) => setForm({ ...form, firstPaymentOnly: v })}
              />
              <Toggle
                label="Yenilemede uygula"
                checked={form.renewalAllowed}
                onChange={(v) => setForm({ ...form, renewalAllowed: v })}
              />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Toggle
              label="Otomatik uygula"
              checked={form.autoApply}
              onChange={(v) => setForm({ ...form, autoApply: v })}
            />
            <Toggle
              label="Stackable (diğer indirimlerle birleşebilir)"
              checked={form.stackable}
              onChange={(v) => setForm({ ...form, stackable: v })}
            />
            <Field label="Öncelik (yüksek önce uygulanır)">
              <input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                className={appInputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Maks. kullanım">
                <input
                  type="number"
                  value={form.maxRedemptions ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxRedemptions: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={appInputClass}
                />
              </Field>
              <Field label="Firma başı maks. kullanım">
                <input
                  type="number"
                  value={form.maxRedemptionsPerCompany ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxRedemptionsPerCompany: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={appInputClass}
                />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Başlangıç *">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className={appInputClass}
                />
              </Field>
              <Field label="Bitiş (opsiyonel)">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  className={appInputClass}
                />
              </Field>
            </div>
            <Toggle
              label="Oluşturulduktan hemen sonra yayınla"
              checked={form.publish}
              onChange={(v) => setForm({ ...form, publish: v })}
            />
          </>
        )}

        {step === 5 && (
          <>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px]">
              <p className="font-bold text-[#0f1f4d]">{form.name}</p>
              <p className="mt-2 text-slate-600">
                {formatDiscountLabel(form.discountType, form.discountValue, formatMinorToMoney)} ·{" "}
                {formatCampaignScopeSummary(
                  scopes.map((s) => ({
                    plan: s.planId
                      ? { id: s.planId, name: plans.find((p) => p.id === s.planId)?.name ?? "—" }
                      : null,
                    billingInterval: s.billingInterval,
                  }))
                )}
              </p>
              <p className="mt-1 text-slate-500">
                Öncelik: {form.priority} · Otomatik: {form.autoApply ? "Evet" : "Hayır"} ·
                Stackable: {form.stackable ? "Evet" : "Hayır"}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-[14px] font-extrabold text-[#0f1f4d]">Çakışma Analizi</h3>
              {conflictsLoading ? (
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Analiz ediliyor…
                </div>
              ) : conflicts.length === 0 ? (
                <p className="text-[13px] text-emerald-700">Engelleyici çakışma bulunamadı.</p>
              ) : (
                <div className="space-y-2">
                  {conflicts.map((conflict, index) => (
                    <div
                      key={`${conflict.campaignId}-${index}`}
                      className={`rounded-xl border p-3 text-[13px] ${getConflictSeverityClass(conflict.severity)}`}
                    >
                      <p className="font-bold">
                        [{conflict.severity}]{" "}
                        <Link
                          href={`/admin/membership-campaigns/${conflict.campaignId}`}
                          className="underline"
                        >
                          {conflict.campaignName}
                        </Link>
                      </p>
                      <p className="mt-1">{conflict.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className={appOutlineButtonClass}
            >
              Geri
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={nextStep} className={appPrimaryButtonClass}>
              İleri
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit(false)}
                className={appOutlineButtonClass}
              >
                {saving ? "Kaydediliyor…" : "Taslak Olarak Kaydet"}
              </button>
              <button
                type="button"
                disabled={saving || hasBlocking}
                onClick={() => handleSubmit(true)}
                className={appPrimaryButtonClass}
              >
                {saving ? "Yayınlanıyor…" : "Yayınla"}
              </button>
            </>
          )}
        </div>
      </div>
    </AdminPageContainer>
  );
}

function buildScopes(form: FormState) {
  if (form.allPlans && form.allIntervals) return [];

  const planIds = form.allPlans ? [null] : form.planIds.length ? form.planIds : [null];
  const intervals = form.allIntervals
    ? [null]
    : form.intervals.length
      ? form.intervals
      : [null];

  const rows: Array<{
    planId: string | null;
    billingInterval: MembershipPeriod | null;
    firstPaymentOnly?: boolean;
    renewalAllowed?: boolean;
  }> = [];

  for (const planId of planIds) {
    for (const billingInterval of intervals) {
      rows.push({
        planId,
        billingInterval: billingInterval as MembershipPeriod | null,
        firstPaymentOnly: form.firstPaymentOnly,
        renewalAllowed: form.renewalAllowed,
      });
    }
  }
  return rows;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
