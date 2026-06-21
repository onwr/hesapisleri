"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appOutlineButtonClass, appPanelClass, appPrimaryButtonClass } from "@/lib/admin-ui";

export function AdminCouponBulkForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    prefix: "PROMO",
    count: 10,
    codeLength: 6,
    name: "Toplu Kupon",
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: "",
    maxUsage: 1,
    maxUsagePerCompany: 1,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setBatchId(null);
    setCreatedCount(null);
    try {
      const res = await fetch("/api/admin/membership-coupons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Toplu kupon oluşturulamadı.");
      setBatchId(json.data.batchId);
      setCreatedCount(json.data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    if (!batchId) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/membership-coupons/bulk/export-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Export token alınamadı.");
      window.location.href = json.data.downloadUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV indirilemedi.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AdminPageContainer size="default">
      <AdminPageHeader
        title="Toplu Kupon Oluştur"
        description="Önek ve adet ile toplu indirim kodu üretin."
        backHref="/admin/membership-coupons"
      />
      <form onSubmit={handleSubmit} className={`${appPanelClass} space-y-4 p-5`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Önek">
            <input
              required
              value={form.prefix}
              onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm uppercase"
            />
          </Field>
          <Field label="Adet (max 500)">
            <input
              type="number"
              min={1}
              max={500}
              required
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </Field>
        </div>
        <Field label="Kod uzunluğu">
          <input
            type="number"
            min={4}
            max={10}
            value={form.codeLength}
            onChange={(e) => setForm({ ...form, codeLength: Number(e.target.value) })}
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="İndirim %">
            <input
              type="number"
              required
              value={form.discountValue}
              onChange={(e) =>
                setForm({ ...form, discountValue: Number(e.target.value) })
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Kullanım limiti / kupon">
            <input
              type="number"
              value={form.maxUsage}
              onChange={(e) => setForm({ ...form, maxUsage: Number(e.target.value) })}
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          </Field>
        </div>
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        {batchId ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-900">
            <p className="font-bold">
              {createdCount} kupon oluşturuldu. Batch ID:{" "}
              <span className="font-mono">{batchId}</span>
            </p>
            <p className="mt-1">
              Kodlar güvenlik nedeniyle ekranda gösterilmez. CSV dosyasını yalnızca bir kez
              indirebilirsiniz.
            </p>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className={`${appPrimaryButtonClass} mt-3`}
            >
              {exporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Hazırlanıyor…
                </>
              ) : (
                <>
                  <Download size={16} /> CSV İndir
                </>
              )}
            </button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={appPrimaryButtonClass}>
            {saving ? "Oluşturuluyor…" : "Toplu Oluştur"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/membership-coupons")}
            className={appOutlineButtonClass}
          >
            Listeye Dön
          </button>
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
