"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import { formatIntervalLabel } from "@/lib/admin/promotions/promotion-scope-utils";
import type { MembershipPeriod } from "@prisma/client";

type Plan = { id: string; name: string };

type TargetingData = {
  planIds: string[];
  allowedIntervals: MembershipPeriod[];
  currency: string;
  minimumAmountMinor: number | null;
  maxUsage: number | null;
  maxUsagePerCompany: number;
  newCustomersOnly: boolean;
  firstPaymentOnly: boolean;
  renewalAllowed: boolean;
  stackable: boolean;
  status: string;
};

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

export function AdminCouponTargetingEditor({
  couponId,
  plans,
  archived,
}: {
  couponId: string;
  plans: Plan[];
  archived: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reason, setReason] = useState("");
  const [allPlans, setAllPlans] = useState(true);
  const [allIntervals, setAllIntervals] = useState(true);
  const [form, setForm] = useState<TargetingData | null>(null);

  const loadTargeting = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/targeting`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Hedefleme yüklenemedi.");
      const data = json.data as TargetingData;
      setAllPlans(data.planIds.length === 0);
      setAllIntervals(data.allowedIntervals.length === 0);
      setForm(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hedefleme yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [couponId]);

  useEffect(() => {
    void loadTargeting();
  }, [loadTargeting]);

  async function handleSave() {
    if (!form || saving || archived) return;
    if (!reason.trim()) {
      setError("Güncelleme gerekçesi zorunludur.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}/targeting`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIds: allPlans ? [] : form.planIds,
          allowedIntervals: allIntervals ? [] : form.allowedIntervals,
          currency: form.currency,
          minimumAmountMinor: form.minimumAmountMinor,
          maxUsage: form.maxUsage,
          maxUsagePerCompany: form.maxUsagePerCompany,
          newCustomersOnly: form.newCustomersOnly,
          firstPaymentOnly: form.firstPaymentOnly,
          renewalAllowed: form.renewalAllowed,
          stackable: form.stackable,
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Kayıt başarısız.");
      setSuccess("Hedefleme güncellendi.");
      setReason("");
      await loadTargeting();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={`${appPanelClass} flex items-center gap-2 p-8 text-[13px] text-slate-500`}>
        <Loader2 size={18} className="animate-spin" />
        Hedefleme yükleniyor…
      </div>
    );
  }

  if (!form) {
    return (
      <div className={`${appPanelClass} p-5 text-[13px] text-red-600`}>
        {error || "Hedefleme yüklenemedi."}
      </div>
    );
  }

  return (
    <div className={`${appPanelClass} space-y-4 p-5`}>
      {archived ? (
        <p className="text-[13px] font-semibold text-amber-800">
          Arşivlenmiş kuponun hedeflemesi düzenlenemez.
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={allPlans}
          disabled={archived}
          onChange={(e) => {
            setAllPlans(e.target.checked);
            if (e.target.checked) setForm({ ...form, planIds: [] });
          }}
        />
        Tüm planlar
      </label>
      {!allPlans ? (
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => (
            <label
              key={plan.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            >
              <input
                type="checkbox"
                disabled={archived}
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
          checked={allIntervals}
          disabled={archived}
          onChange={(e) => {
            setAllIntervals(e.target.checked);
            if (e.target.checked) setForm({ ...form, allowedIntervals: [] });
          }}
        />
        Tüm dönemler
      </label>
      {!allIntervals ? (
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((interval) => (
            <label
              key={interval}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            >
              <input
                type="checkbox"
                disabled={archived}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Para birimi">
          <select
            value={form.currency}
            disabled={archived}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className={appSelectClass}
          >
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
        <Field label="Minimum tutar (kuruş)">
          <input
            type="number"
            min={0}
            disabled={archived}
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
        <Field label="Toplam kullanım limiti">
          <input
            type="number"
            min={1}
            disabled={archived}
            value={form.maxUsage ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                maxUsage: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="Sınırsız"
            className={appInputClass}
          />
        </Field>
        <Field label="Firma başına limit">
          <input
            type="number"
            min={1}
            required
            disabled={archived}
            value={form.maxUsagePerCompany}
            onChange={(e) =>
              setForm({ ...form, maxUsagePerCompany: Number(e.target.value) })
            }
            className={appInputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 text-[13px] font-semibold text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={archived}
            checked={form.newCustomersOnly}
            onChange={(e) => setForm({ ...form, newCustomersOnly: e.target.checked })}
          />
          Yalnızca yeni müşteriler
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={archived}
            checked={form.firstPaymentOnly}
            onChange={(e) => setForm({ ...form, firstPaymentOnly: e.target.checked })}
          />
          İlk ödeme
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={archived}
            checked={form.renewalAllowed}
            onChange={(e) => setForm({ ...form, renewalAllowed: e.target.checked })}
          />
          Yenilemede kullanılabilir
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={archived}
            checked={form.stackable}
            onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
          />
          Kampanyalarla birleştirilebilir (stackable)
        </label>
      </div>

      {!archived ? (
        <>
          <Field label="Güncelleme gerekçesi">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={appInputClass}
              placeholder="Değişiklik nedeni"
            />
          </Field>
          {error ? <p className="text-[13px] font-semibold text-red-600">{error}</p> : null}
          {success ? <p className="text-[13px] font-semibold text-emerald-700">{success}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={appPrimaryButtonClass}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Kaydediliyor…
              </>
            ) : (
              "Hedeflemeyi Kaydet"
            )}
          </button>
        </>
      ) : null}
    </div>
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
