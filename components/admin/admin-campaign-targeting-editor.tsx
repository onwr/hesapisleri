"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

type ScopeRow = {
  planId: string | null;
  billingInterval: MembershipPeriod | null;
  firstPaymentOnly: boolean;
  renewalAllowed: boolean;
};

type TargetingData = {
  scopes: ScopeRow[];
  currency: string;
  minimumAmountMinor: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerCompany: number | null;
  newCustomersOnly: boolean;
  existingCustomersAllowed: boolean;
  firstPaymentOnly: boolean;
  renewalAllowed: boolean;
  autoApply: boolean;
  stackable: boolean;
  priority: number;
  status: string;
};

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

function emptyScope(): ScopeRow {
  return {
    planId: null,
    billingInterval: null,
    firstPaymentOnly: false,
    renewalAllowed: true,
  };
}

export function AdminCampaignTargetingEditor({
  campaignId,
  plans,
  archived,
}: {
  campaignId: string;
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
  const [form, setForm] = useState<TargetingData | null>(null);

  const loadTargeting = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/targeting`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Hedefleme yüklenemedi.");
      const data = json.data as TargetingData & {
        scopes: Array<{
          planId: string | null;
          billingInterval: MembershipPeriod | null;
          firstPaymentOnly: boolean;
          renewalAllowed: boolean;
        }>;
      };
      setAllPlans(data.scopes.length === 0);
      setForm({
        scopes: data.scopes.map((s) => ({
          planId: s.planId,
          billingInterval: s.billingInterval,
          firstPaymentOnly: s.firstPaymentOnly,
          renewalAllowed: s.renewalAllowed,
        })),
        currency: data.currency,
        minimumAmountMinor: data.minimumAmountMinor,
        maxRedemptions: data.maxRedemptions,
        maxRedemptionsPerCompany: data.maxRedemptionsPerCompany,
        newCustomersOnly: data.newCustomersOnly,
        existingCustomersAllowed: data.existingCustomersAllowed,
        firstPaymentOnly: data.firstPaymentOnly,
        renewalAllowed: data.renewalAllowed,
        autoApply: data.autoApply,
        stackable: data.stackable,
        priority: data.priority,
        status: data.status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hedefleme yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadTargeting();
  }, [loadTargeting]);

  async function handleSave() {
    if (!form || saving) return;
    if (!reason.trim()) {
      setError("Güncelleme gerekçesi zorunludur.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/targeting`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopes: allPlans ? [] : form.scopes,
          reason: reason.trim(),
          currency: form.currency,
          minimumAmountMinor: form.minimumAmountMinor,
          maxRedemptions: form.maxRedemptions,
          maxRedemptionsPerCompany: form.maxRedemptionsPerCompany,
          newCustomersOnly: form.newCustomersOnly,
          existingCustomersAllowed: form.existingCustomersAllowed,
          firstPaymentOnly: form.firstPaymentOnly,
          renewalAllowed: form.renewalAllowed,
          autoApply: form.autoApply,
          stackable: form.stackable,
          priority: form.priority,
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

  function updateScope(index: number, patch: Partial<ScopeRow>) {
    if (!form) return;
    const scopes = [...form.scopes];
    scopes[index] = { ...scopes[index]!, ...patch };
    setForm({ ...form, scopes });
  }

  function addScope() {
    if (!form) return;
    setAllPlans(false);
    setForm({ ...form, scopes: [...form.scopes, emptyScope()] });
  }

  function removeScope(index: number) {
    if (!form) return;
    const scopes = form.scopes.filter((_, i) => i !== index);
    setForm({ ...form, scopes });
    if (!scopes.length) setAllPlans(true);
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

  const readOnly = archived || form.status === "ARCHIVED";

  return (
    <div className={`${appPanelClass} space-y-5 p-5`}>
      {readOnly ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
          Arşivlenmiş kampanyanın hedeflemesi düzenlenemez.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Para birimi">
          <select
            value={form.currency}
            disabled={readOnly}
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
            disabled={readOnly}
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
        <Field label="Öncelik">
          <input
            type="number"
            min={0}
            max={9999}
            disabled={readOnly}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
            className={appInputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Genel kullanım limiti">
          <input
            type="number"
            min={1}
            disabled={readOnly}
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
        <Field label="Firma başına limit">
          <input
            type="number"
            min={1}
            disabled={readOnly}
            value={form.maxRedemptionsPerCompany ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                maxRedemptionsPerCompany: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={appInputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4 text-[13px]">
        <Toggle
          label="Yalnızca yeni müşteri"
          checked={form.newCustomersOnly}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, newCustomersOnly: v })}
        />
        <Toggle
          label="Mevcut müşterilere izin"
          checked={form.existingCustomersAllowed}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, existingCustomersAllowed: v })}
        />
        <Toggle
          label="İlk ödeme"
          checked={form.firstPaymentOnly}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, firstPaymentOnly: v })}
        />
        <Toggle
          label="Yenileme"
          checked={form.renewalAllowed}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, renewalAllowed: v })}
        />
        <Toggle
          label="Otomatik uygula"
          checked={form.autoApply}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, autoApply: v })}
        />
        <Toggle
          label="Stackable"
          checked={form.stackable}
          disabled={readOnly}
          onChange={(v) => setForm({ ...form, stackable: v })}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-extrabold text-[#0f1f4d]">Plan kapsamı</h3>
          {!readOnly ? (
            <button type="button" onClick={addScope} className={appOutlineButtonClass}>
              <Plus size={14} /> Kapsam ekle
            </button>
          ) : null}
        </div>
        <label className="mb-3 flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={allPlans}
            disabled={readOnly}
            onChange={(e) => {
              setAllPlans(e.target.checked);
              if (e.target.checked) setForm({ ...form, scopes: [] });
            }}
          />
          Tüm planlar ve dönemler
        </label>
        {!allPlans && form.scopes.length === 0 ? (
          <p className="text-[13px] text-slate-500">En az bir kapsam ekleyin veya tüm planları seçin.</p>
        ) : null}
        {!allPlans ? (
          <div className="space-y-3">
            {form.scopes.map((scope, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-4"
              >
                <Field label="Plan">
                  <select
                    value={scope.planId ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateScope(index, { planId: e.target.value || null })
                    }
                    className={appSelectClass}
                  >
                    <option value="">Tüm planlar</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dönem">
                  <select
                    value={scope.billingInterval ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateScope(index, {
                        billingInterval: (e.target.value as MembershipPeriod) || null,
                      })
                    }
                    className={appSelectClass}
                  >
                    <option value="">Tüm dönemler</option>
                    {INTERVALS.map((i) => (
                      <option key={i} value={i}>
                        {formatIntervalLabel(i)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-col justify-end gap-2 text-[12px]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scope.firstPaymentOnly}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateScope(index, { firstPaymentOnly: e.target.checked })
                      }
                    />
                    İlk ödeme
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scope.renewalAllowed}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateScope(index, { renewalAllowed: e.target.checked })
                      }
                    />
                    Yenileme
                  </label>
                </div>
                {!readOnly ? (
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeScope(index)}
                      className={appOutlineButtonClass}
                    >
                      <Trash2 size={14} /> Kaldır
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <Field label="Güncelleme gerekçesi *">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={appInputClass}
            placeholder="Hedefleme değişikliği nedeni"
          />
        </Field>
      ) : null}

      {error ? <p className="text-[13px] font-semibold text-red-600">{error}</p> : null}
      {success ? <p className="text-[13px] font-semibold text-emerald-700">{success}</p> : null}

      {!readOnly ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
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
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-[13px]">
      <span className="font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
