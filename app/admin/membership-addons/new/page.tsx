"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import { ENTITLEMENT_REGISTRY } from "@/lib/billing/entitlements/entitlement-registry";

const LIMIT_OPTIONS = Object.values(ENTITLEMENT_REGISTRY).filter((e) => e.kind === "LIMIT");

export default function AdminMembershipAddonNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "RECURRING",
    entitlementCode: "MAX_USERS",
    entitlementQuantity: 1,
    listPriceMinor: 9900,
    salePriceMinor: 9900,
    billingInterval: "MONTHLY",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/membership-addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          type: form.type,
          status: "DRAFT",
          entitlementCode: form.entitlementCode,
          entitlementQuantity: form.entitlementQuantity,
          initialPrice: {
            billingInterval: form.type === "RECURRING" ? form.billingInterval : null,
            listPriceMinor: form.listPriceMinor,
            salePriceMinor: form.salePriceMinor,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Oluşturulamadı");
      router.push(`/admin/membership-addons/${json.data.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Yeni Ek Paket"
        description="Kapasite veya kullanım hakkı paketi tanımlayın."
        secondaryActions={
          <Link href="/admin/membership-addons" className={appOutlineButtonClass}>
            Geri
          </Link>
        }
      />
      <form onSubmit={handleSubmit} className={`${appPanelClass} space-y-4 p-6`}>
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            Ad
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Kod
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Tür
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              <option value="RECURRING">Yinelenen</option>
              <option value="ONE_TIME">Tek Seferlik</option>
              <option value="USAGE_PACK">Kullanım Paketi</option>
            </select>
          </label>
          <label className="block text-sm">
            Entitlement
            <select
              value={form.entitlementCode}
              onChange={(e) => setForm({ ...form, entitlementCode: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Miktar
            <input
              type="number"
              min={1}
              value={form.entitlementQuantity}
              onChange={(e) =>
                setForm({ ...form, entitlementQuantity: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Satış Fiyatı (kuruş)
            <input
              type="number"
              min={0}
              value={form.salePriceMinor}
              onChange={(e) =>
                setForm({ ...form, salePriceMinor: Number(e.target.value), listPriceMinor: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <button type="submit" disabled={loading} className={appPrimaryButtonClass}>
          {loading ? "Kaydediliyor..." : "Oluştur"}
        </button>
      </form>
    </AdminPageContainer>
  );
}
