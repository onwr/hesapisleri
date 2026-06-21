"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { SUPPLIER_CATEGORIES } from "@/lib/supplier-utils";

type SupplierRecord = {
  id: string;
  name: string;
  companyName: string | null;
  code: string | null;
  contactName: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  iban: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  category: string | null;
  tags: string[];
  notes: string | null;
  currency: string;
  paymentTermDays: number | null;
  isFavorite: boolean;
  isActive: boolean;
};

export function EditSupplierForm({ supplier }: { supplier: SupplierRecord }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: supplier.name,
    companyName: supplier.companyName ?? "",
    code: supplier.code ?? "",
    contactName: supplier.contactName ?? "",
    phone: supplier.phone ?? "",
    mobilePhone: supplier.mobilePhone ?? "",
    email: supplier.email ?? "",
    website: supplier.website ?? "",
    taxNumber: supplier.taxNumber ?? "",
    taxOffice: supplier.taxOffice ?? "",
    iban: supplier.iban ?? "",
    address: supplier.address ?? "",
    city: supplier.city ?? "",
    district: supplier.district ?? "",
    country: supplier.country ?? "Türkiye",
    category: supplier.category ?? "",
    tags: supplier.tags.join(", "),
    notes: supplier.notes ?? "",
    currency: supplier.currency,
    paymentTermDays:
      supplier.paymentTermDays != null ? String(supplier.paymentTermDays) : "",
    isFavorite: supplier.isFavorite,
    isActive: supplier.isActive,
  });

  function updateForm(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const name = form.name.trim();
    const companyName = form.companyName.trim();

    if (!name && !companyName) {
      setError("Tedarikçi adı veya firma adı zorunludur.");
      setSaving(false);
      return;
    }

    try {
      const paymentTermDays = form.paymentTermDays.trim();
      const payload: Record<string, unknown> = {
        name: name || undefined,
        companyName: companyName || undefined,
        code: form.code.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        mobilePhone: form.mobilePhone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        taxOffice: form.taxOffice.trim() || undefined,
        taxNumber: form.taxNumber.trim() || undefined,
        iban: form.iban.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        district: form.district.trim() || undefined,
        country: form.country.trim() || "Türkiye",
        category: form.category.trim() || undefined,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: form.notes.trim() || undefined,
        currency: form.currency.trim() || "TRY",
        paymentTermDays: paymentTermDays
          ? Number.parseInt(paymentTermDays, 10)
          : null,
        isFavorite: form.isFavorite,
        isActive: form.isActive,
      };

      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Tedarikçi güncellenemedi.");
        return;
      }

      router.push(`/suppliers/${supplier.id}`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `"${supplier.name}" tedarikçisini kalıcı olarak silmek istediğinize emin misiniz?\n\nGider veya stok hareketi varsa silme engellenir.`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Tedarikçi silinemedi.");
        return;
      }

      router.push("/suppliers");
      router.refresh();
    } catch {
      setError("Tedarikçi silinirken bir hata oluştu.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="customers"
          title="Tedarikçi güncelleniyor"
          subtitle="Değişiklikler kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-4">
            <Link
              href={`/suppliers/${supplier.id}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} strokeWidth={2.6} />
            </Link>
            <div>
              <h1 className="text-[24px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                Tedarikçiyi Düzenle
              </h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                Bakiye değişikliği için ayrı finansal hareket kullanılmalıdır.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Temel Bilgiler" icon={<Truck size={20} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Tedarikçi Adı" value={form.name} onChange={(v) => updateForm("name", v)} icon={<Truck size={18} />} />
              <InputField label="Firma Adı" value={form.companyName} onChange={(v) => updateForm("companyName", v)} icon={<Building2 size={18} />} />
              <InputField label="Kod" value={form.code} onChange={(v) => updateForm("code", v)} icon={<ReceiptText size={18} />} />
              <SelectField label="Kategori" value={form.category} onChange={(v) => updateForm("category", v)} options={[{ value: "", label: "Seçiniz" }, ...SUPPLIER_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#24345f]">
                <input type="checkbox" checked={form.isFavorite} onChange={(e) => updateForm("isFavorite", e.target.checked)} />
                Favori
              </label>
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#24345f]">
                <input type="checkbox" checked={form.isActive} onChange={(e) => updateForm("isActive", e.target.checked)} />
                Aktif
              </label>
            </div>
          </FormSection>

          <FormSection title="İletişim" icon={<Phone size={20} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Yetkili" value={form.contactName} onChange={(v) => updateForm("contactName", v)} icon={<Truck size={18} />} />
              <InputField label="Telefon" value={form.phone} onChange={(v) => updateForm("phone", v)} icon={<Phone size={18} />} />
              <InputField label="Cep" value={form.mobilePhone} onChange={(v) => updateForm("mobilePhone", v)} icon={<Phone size={18} />} />
              <InputField label="E-posta" value={form.email} onChange={(v) => updateForm("email", v)} icon={<Mail size={18} />} />
            </div>
          </FormSection>

          <FormSection title="Vergi ve Adres" icon={<MapPin size={20} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Vergi No" value={form.taxNumber} onChange={(v) => updateForm("taxNumber", v)} icon={<Building2 size={18} />} />
              <InputField label="Vergi Dairesi" value={form.taxOffice} onChange={(v) => updateForm("taxOffice", v)} icon={<Building2 size={18} />} />
              <InputField label="İl" value={form.city} onChange={(v) => updateForm("city", v)} icon={<MapPin size={18} />} />
              <InputField label="İlçe" value={form.district} onChange={(v) => updateForm("district", v)} icon={<MapPin size={18} />} />
              <div className="md:col-span-2">
                <label className="text-[12px] font-black text-[#24345f]">Adres</label>
                <textarea value={form.address} onChange={(e) => updateForm("address", e.target.value)} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Finansal" icon={<Wallet size={20} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Para Birimi" value={form.currency} onChange={(v) => updateForm("currency", v)} icon={<Wallet size={18} />} />
              <InputField label="Vade (gün)" value={form.paymentTermDays} onChange={(v) => updateForm("paymentTermDays", v)} icon={<ReceiptText size={18} />} />
              <InputField label="IBAN" value={form.iban} onChange={(v) => updateForm("iban", v)} icon={<Wallet size={18} />} />
            </div>
          </FormSection>

          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={saving || deleting} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-blue-100 disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <Link href={`/suppliers/${supplier.id}`} className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-[#24345f]">
              Vazgeç
            </Link>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-[13px] font-black text-rose-700">Tehlikeli bölge</p>
            <p className="mt-1 text-[12px] font-medium leading-6 text-rose-600/90">
              Tedarikçiyi kalıcı olarak siler. Gider veya stok hareketi varsa silme engellenir; bu durumda pasife alabilirsiniz.
            </p>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={saving || deleting}
              className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-[12px] font-black text-rose-600 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
              Tedarikçiyi Sil
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
        <h2 className="text-[16px] font-black text-[#0f1f4d]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InputField({ label, value, onChange, icon }: { label: string; value: string; onChange: (v: string) => void; icon: ReactNode }) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>
      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50" />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50">
        {options.map((o) => <option key={o.value || "e"} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
