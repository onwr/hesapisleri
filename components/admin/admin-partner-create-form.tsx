"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";
import Link from "next/link";

export function AdminPartnerCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = {
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? "") || null,
      referralCode: String(fd.get("referralCode") ?? "") || undefined,
      commissionRate: Number(fd.get("commissionRate") ?? 10),
      badgeType: String(fd.get("badgeType") ?? "PARTNER"),
      accountHolderName: String(fd.get("accountHolderName") ?? "") || null,
      taxNumber: String(fd.get("taxNumber") ?? "") || null,
      reason: String(fd.get("reason") ?? ""),
    };
    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      router.push(`/admin/partners/${json.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader title="Yeni Partner" backHref="/admin/partners" />
      <form onSubmit={submit} className={`${appPanelClass} max-w-xl space-y-3 p-5 text-[13px]`}>
        <label className="block">
          Ad Soyad
          <input name="fullName" required className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          E-posta
          <input name="email" type="email" required className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          Telefon
          <input name="phone" className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          Referans kodu (opsiyonel)
          <input name="referralCode" className="mt-1 w-full rounded border px-2 py-1.5 font-mono uppercase" />
        </label>
        <label className="block">
          Komisyon %
          <input name="commissionRate" type="number" min={0} max={100} defaultValue={10} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          Rozet tipi
          <select name="badgeType" className="mt-1 w-full rounded border px-2 py-1.5" defaultValue="PARTNER">
            <option value="PARTNER">Partner</option>
            <option value="VERIFIED">Doğrulanmış</option>
            <option value="INFLUENCER">Influencer</option>
          </select>
        </label>
        <label className="block">
          Yasal unvan
          <input name="accountHolderName" className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          Vergi no
          <input name="taxNumber" className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label className="block">
          Sebep
          <textarea name="reason" rows={2} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        {error ? <p className="text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <Link href="/admin/partners" className={appOutlineButtonClass}>
            İptal
          </Link>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading}>
            {loading ? "Kaydediliyor…" : "Oluştur"}
          </button>
        </div>
      </form>
    </AdminPageContainer>
  );
}
