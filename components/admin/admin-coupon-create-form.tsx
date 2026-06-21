"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { formatIntervalLabel } from "@/lib/admin/promotions/promotion-scope-utils";
import type { MembershipPeriod } from "@prisma/client";

type Plan = { id: string; name: string };
type Company = { id: string; name: string };

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

export function AdminCouponCreateForm({
  plans,
  companies = [],
}: {
  plans: Plan[];
  companies?: Company[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: "",
    maxUsage: 100,
    maxUsagePerCompany: 1,
    firstPaymentOnly: true,
    renewalAllowed: false,
    stackable: false,
    activate: true,
    allPlans: true,
    planIds: [] as string[],
    allIntervals: true,
    allowedIntervals: [] as MembershipPeriod[],
    previewCompanyId: companies[0]?.id ?? "",
    previewPlanId: plans[0]?.id ?? "",
    previewInterval: "MONTHLY" as MembershipPeriod,
  });

  useEffect(() => {
    if (!form.code || form.code.length < 3) {
      setPreview(null);
      return;
    }
    if (!form.previewCompanyId || !form.previewPlanId) return;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const res = await fetch("/api/admin/membership-coupons/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: form.previewCompanyId,
            planId: form.previewPlanId,
            billingInterval: form.previewInterval,
            couponCode: form.code,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Önizleme başarısız.");
        setPreview(json.data);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Önizleme başarısız.");
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    form.code,
    form.previewCompanyId,
    form.previewPlanId,
    form.previewInterval,
    form.discountType,
    form.discountValue,
    form.planIds,
    form.allPlans,
    form.allowedIntervals,
    form.allIntervals,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/membership-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          description: form.description || null,
          discountType: form.discountType,
          discountValue: form.discountValue,
          startsAt: new Date(form.startsAt).toISOString(),
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          maxUsage: form.maxUsage,
          maxUsagePerCompany: form.maxUsagePerCompany,
          firstPaymentOnly: form.firstPaymentOnly,
          renewalAllowed: form.renewalAllowed,
          stackable: form.stackable,
          activate: form.activate,
          planIds: form.allPlans ? undefined : form.planIds,
          allowedIntervals: form.allIntervals ? undefined : form.allowedIntervals,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Kupon oluşturulamadı.");
      router.push(`/admin/membership-coupons/${json.data.id}`);
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
        title="Yeni Kupon"
        description="İndirim kodu oluşturun ve canlı fiyat önizlemesi görün."
        backHref="/admin/membership-coupons"
      />
      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={`${appPanelClass} space-y-4 p-5`}>
          <Field label="Kod">
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={`${appInputClass} font-mono uppercase`}
            />
          </Field>
          <Field label="İsim">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={appInputClass}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="İndirim Tipi">
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountType: e.target.value as typeof form.discountType,
                  })
                }
                className={appSelectClass}
              >
                <option value="PERCENTAGE">Yüzde</option>
                <option value="FIXED_AMOUNT">Sabit Tutar</option>
                <option value="OVERRIDE_PRICE">Fiyat Override</option>
              </select>
            </Field>
            <Field label="Değer">
              <input
                type="number"
                required
                value={form.discountValue}
                onChange={(e) =>
                  setForm({ ...form, discountValue: Number(e.target.value) })
                }
                className={appInputClass}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.allPlans}
              onChange={(e) =>
                setForm({ ...form, allPlans: e.target.checked, planIds: [] })
              }
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
                setForm({ ...form, allIntervals: e.target.checked, allowedIntervals: [] })
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
                    checked={form.allowedIntervals.includes(interval)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.allowedIntervals, interval]
                        : form.allowedIntervals.filter((i) => i !== interval);
                      setForm({ ...form, allowedIntervals: next });
                    }}
                  />
                  {formatIntervalLabel(interval)}
                </label>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Başlangıç">
              <input
                type="datetime-local"
                required
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className={appInputClass}
              />
            </Field>
            <Field label="Bitiş">
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className={appInputClass}
              />
            </Field>
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving} className={appPrimaryButtonClass}>
            {saving ? "Kaydediliyor…" : "Kupon Oluştur"}
          </button>
        </div>

        <div className={`${appPanelClass} space-y-4 p-5`}>
          <h2 className="text-[15px] font-extrabold text-[#0f1f4d]">Canlı Fiyat Önizleme</h2>
          {companies.length ? (
            <select
              value={form.previewCompanyId}
              onChange={(e) => setForm({ ...form, previewCompanyId: e.target.value })}
              className={appSelectClass}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            value={form.previewPlanId}
            onChange={(e) => setForm({ ...form, previewPlanId: e.target.value })}
            className={appSelectClass}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <select
            value={form.previewInterval}
            onChange={(e) =>
              setForm({
                ...form,
                previewInterval: e.target.value as MembershipPeriod,
              })
            }
            className={appSelectClass}
          >
            {INTERVALS.map((interval) => (
              <option key={interval} value={interval}>
                {formatIntervalLabel(interval)}
              </option>
            ))}
          </select>
          {previewLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Hesaplanıyor…
            </div>
          ) : previewError ? (
            <p className="text-[13px] font-semibold text-amber-700">{previewError}</p>
          ) : preview ? (
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-[13px]">
              <p>Liste fiyatı: {String(preview.listFormatted ?? preview.listPriceMinor)}</p>
              <p className="font-bold text-[#0f1f4d]">
                Toplam: {String(preview.totalFormatted ?? preview.totalMinor)}
              </p>
              {Array.isArray(preview.appliedDiscounts) && preview.appliedDiscounts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-slate-600">
                  {(preview.appliedDiscounts as Array<{ type: string; amountMinor: number }>).map(
                    (d, i) => (
                      <li key={i}>
                        {d.type}: {formatMinorToMoney(d.amountMinor)}
                      </li>
                    )
                  )}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Önizleme için geçerli bir kupon kodu girin.
            </p>
          )}
        </div>
      </form>
    </AdminPageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
