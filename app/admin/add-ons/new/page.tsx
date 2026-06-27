"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import {
  appInputClass,
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
} from "@/lib/admin-ui";
import { ENTITLEMENT_REGISTRY } from "@/lib/billing/entitlements/entitlement-registry";

const ENTITLEMENT_OPTIONS = Object.values(ENTITLEMENT_REGISTRY);

export default function AdminAddOnNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "RECURRING" as const,
    entitlementCode: "MAX_USERS",
    entitlementQuantity: 1,
    currency: "TRY" as const,
    listPriceMinor: 9900,
    salePriceMinor: 9900,
    billingInterval: "MONTHLY" as const,
    isPublic: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/add-ons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          type: form.type,
          entitlementCode: form.entitlementCode,
          entitlementQuantity: form.entitlementQuantity,
          currency: form.currency,
          isPublic: form.isPublic,
          initialPrice: {
            billingInterval: form.type === "RECURRING" ? form.billingInterval : null,
            listPriceMinor: form.listPriceMinor,
            salePriceMinor: form.salePriceMinor,
            currency: form.currency,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Oluşturulamadı.");
      router.push(`/admin/add-ons/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Yeni Ek Paket"
        description="Kapasite veya kullanım hakkı paketi tanımlayın (taslak)."
        backHref="/admin/add-ons"
      />
      <form onSubmit={handleSubmit} className={`${appPanelClass} space-y-4 p-6`}>
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Ad">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={appInputClass}
            />
          </Field>
          <Field label="Kod">
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={`${appInputClass} font-mono uppercase`}
            />
          </Field>
          <Field label="Tür">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
              className={appSelectClass}
            >
              <option value="RECURRING">Yinelenen</option>
              <option value="ONE_TIME">Tek Seferlik</option>
              <option value="USAGE_PACK">Kullanım Paketi</option>
            </select>
          </Field>
          <Field label="Entitlement">
            <select
              value={form.entitlementCode}
              onChange={(e) => setForm({ ...form, entitlementCode: e.target.value })}
              className={appSelectClass}
            >
              {ENTITLEMENT_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.kind})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Miktar">
            <input
              type="number"
              min={1}
              required
              value={form.entitlementQuantity}
              onChange={(e) =>
                setForm({ ...form, entitlementQuantity: Number(e.target.value) })
              }
              className={appInputClass}
            />
          </Field>
          <Field label="Para birimi">
            <select
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value as typeof form.currency })
              }
              className={appSelectClass}
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <Field label="Satış fiyatı (kuruş)">
            <input
              type="number"
              min={0}
              required
              value={form.salePriceMinor}
              onChange={(e) => {
                const v = Number(e.target.value);
                setForm({ ...form, salePriceMinor: v, listPriceMinor: v });
              }}
              className={appInputClass}
            />
          </Field>
        </div>
        <button type="submit" disabled={loading} className={appPrimaryButtonClass}>
          {loading ? "Kaydediliyor…" : "Taslak Oluştur"}
        </button>
        <Link href="/admin/add-ons" className={appOutlineButtonClass}>
          İptal
        </Link>
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
