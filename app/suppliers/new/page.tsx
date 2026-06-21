"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Save,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { SUPPLIER_CATEGORIES } from "@/lib/supplier-utils";

export default function NewSupplierPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    companyName: "",
    code: "",
    contactName: "",
    phone: "",
    mobilePhone: "",
    email: "",
    website: "",
    taxNumber: "",
    taxOffice: "",
    address: "",
    city: "",
    district: "",
    country: "Türkiye",
    category: "",
    iban: "",
    openingBalance: "0",
    currency: "TRY",
    paymentTermDays: "",
    notes: "",
    tags: "",
    isFavorite: false,
  });

  function updateForm(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const name = form.name.trim();
    const companyName = form.companyName.trim();

    if (!name && !companyName) {
      setFieldErrors({ name: "Tedarikçi adı veya firma adı zorunludur." });
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
        openingBalance: Number.parseFloat(form.openingBalance) || 0,
        currency: form.currency.trim() || "TRY",
        paymentTermDays: paymentTermDays
          ? Number.parseInt(paymentTermDays, 10)
          : null,
        isFavorite: form.isFavorite,
      };

      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Tedarikçi oluşturulamadı.");
        return;
      }

      const supplierId = data.data?.id as string | undefined;
      router.push(
        supplierId ? `/suppliers/${supplierId}?created=1` : "/suppliers"
      );
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const filledFields = [
    form.name,
    form.companyName,
    form.phone,
    form.email,
    form.taxNumber,
    form.address,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="customers"
          title="Tedarikçi kaydediliyor"
          subtitle="Bilgileriniz kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/suppliers"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Yeni Tedarikçi Kaydı
                </div>

                <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Tedarikçi Bilgileri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Tedarikçi veya firma bilgilerini girin. Tedarikçi adı veya firma
                  adından en az biri zorunludur; diğer alanları sonra
                  tamamlayabilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopMiniCard
                label="Durum"
                value="Yeni Kayıt"
                icon={<Truck size={17} />}
                color="emerald"
              />
              <TopMiniCard
                label="Zorunlu Alan"
                value="Ad / Firma"
                icon={<CheckCircle2 size={17} />}
                color="blue"
              />
              <TopMiniCard
                label="Doluluk"
                value={`${filledFields}/6 alan`}
                icon={<FileText size={17} />}
                color="violet"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormSection
              title="Temel Bilgiler"
              description="Tedarikçiyi sistemde tanımlamak için gerekli bilgiler."
              icon={<Truck size={20} strokeWidth={2.4} />}
              iconClass="bg-emerald-50 text-emerald-600"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Tedarikçi Adı"
                  icon={<Truck size={18} />}
                  value={form.name}
                  onChange={(value) => updateForm("name", value)}
                  placeholder="Ahmet Yılmaz"
                  error={fieldErrors.name}
                />
                <InputField
                  label="Firma Adı"
                  icon={<Building2 size={18} />}
                  value={form.companyName}
                  onChange={(value) => updateForm("companyName", value)}
                  placeholder="ABC Ltd. Şti."
                />
                <InputField
                  label="Tedarikçi Kodu"
                  icon={<FileText size={18} />}
                  value={form.code}
                  onChange={(value) => updateForm("code", value)}
                  placeholder="TDR-001"
                />
                <SelectField
                  label="Kategori"
                  icon={<Building2 size={18} />}
                  value={form.category}
                  onChange={(value) => updateForm("category", value)}
                  options={[
                    { value: "", label: "Seçiniz" },
                    ...SUPPLIER_CATEGORIES.map((item) => ({
                      value: item,
                      label: item,
                    })),
                  ]}
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#24345f]">
                <input
                  type="checkbox"
                  checked={form.isFavorite}
                  onChange={(event) => updateForm("isFavorite", event.target.checked)}
                />
                Favori tedarikçi
              </label>
            </FormSection>

            <FormSection
              title="İletişim"
              description="Yetkili kişi ve iletişim kanalları."
              icon={<Phone size={20} strokeWidth={2.4} />}
              iconClass="bg-blue-50 text-blue-600"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Yetkili Kişi"
                  icon={<Truck size={18} />}
                  value={form.contactName}
                  onChange={(value) => updateForm("contactName", value)}
                  placeholder="Mehmet Demir"
                />
                <InputField
                  label="Telefon"
                  icon={<Phone size={18} />}
                  value={form.phone}
                  onChange={(value) => updateForm("phone", value)}
                  placeholder="0212 000 00 00"
                />
                <InputField
                  label="Cep Telefonu"
                  icon={<Phone size={18} />}
                  value={form.mobilePhone}
                  onChange={(value) => updateForm("mobilePhone", value)}
                  placeholder="0532 000 00 00"
                />
                <InputField
                  label="E-posta"
                  type="email"
                  icon={<Mail size={18} />}
                  value={form.email}
                  onChange={(value) => updateForm("email", value)}
                  placeholder="info@firma.com"
                />
                <div className="md:col-span-2">
                  <InputField
                    label="Web Sitesi"
                    icon={<Mail size={18} />}
                    value={form.website}
                    onChange={(value) => updateForm("website", value)}
                    placeholder="https://firma.com"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Vergi Bilgileri"
              description="Vergi numarası ve vergi dairesi."
              icon={<ReceiptText size={20} strokeWidth={2.4} />}
              iconClass="bg-violet-50 text-violet-600"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Vergi No"
                  icon={<Building2 size={18} />}
                  value={form.taxNumber}
                  onChange={(value) => updateForm("taxNumber", value)}
                  placeholder="Opsiyonel"
                />
                <InputField
                  label="Vergi Dairesi"
                  icon={<Building2 size={18} />}
                  value={form.taxOffice}
                  onChange={(value) => updateForm("taxOffice", value)}
                  placeholder="Örn. Battalgazi Vergi Dairesi"
                />
              </div>
            </FormSection>

            <FormSection
              title="Adres"
              description="Teslimat ve fatura süreçlerinde kullanılabilir."
              icon={<MapPin size={20} strokeWidth={2.4} />}
              iconClass="bg-orange-50 text-orange-500"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Ülke"
                  icon={<MapPin size={18} />}
                  value={form.country}
                  onChange={(value) => updateForm("country", value)}
                />
                <InputField
                  label="İl"
                  icon={<MapPin size={18} />}
                  value={form.city}
                  onChange={(value) => updateForm("city", value)}
                />
                <InputField
                  label="İlçe"
                  icon={<MapPin size={18} />}
                  value={form.district}
                  onChange={(value) => updateForm("district", value)}
                />
                <div className="md:col-span-2">
                  <label className="text-[12px] font-black text-[#24345f]">
                    Açık Adres
                  </label>
                  <div className="relative mt-2">
                    <MapPin
                      size={18}
                      className="absolute left-4 top-4 text-slate-400"
                    />
                    <textarea
                      value={form.address}
                      onChange={(e) => updateForm("address", e.target.value)}
                      className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                      placeholder="Tedarikçi adresi"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Finansal Bilgiler"
              description="Açılış bakiyesi ve ödeme koşulları."
              icon={<Wallet size={20} strokeWidth={2.4} />}
              iconClass="bg-emerald-50 text-emerald-600"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="Açılış Bakiyesi"
                  type="number"
                  icon={<Wallet size={18} />}
                  value={form.openingBalance}
                  onChange={(value) => updateForm("openingBalance", value)}
                  placeholder="0"
                />
                <InputField
                  label="Para Birimi"
                  icon={<Wallet size={18} />}
                  value={form.currency}
                  onChange={(value) => updateForm("currency", value)}
                  placeholder="TRY"
                />
                <InputField
                  label="Vade (gün)"
                  type="number"
                  icon={<ReceiptText size={18} />}
                  value={form.paymentTermDays}
                  onChange={(value) => updateForm("paymentTermDays", value)}
                  placeholder="30"
                />
                <InputField
                  label="IBAN"
                  icon={<Wallet size={18} />}
                  value={form.iban}
                  onChange={(value) => updateForm("iban", value)}
                  placeholder="TR..."
                />
              </div>
            </FormSection>

            <FormSection
              title="Notlar"
              description="Etiketler ve özel notlar."
              icon={<FileText size={20} strokeWidth={2.4} />}
              iconClass="bg-slate-100 text-slate-600"
            >
              <InputField
                label="Etiketler"
                icon={<FileText size={18} />}
                value={form.tags}
                onChange={(value) => updateForm("tags", value)}
                placeholder="acil, yerli"
              />
              <div className="mt-4">
                <label className="text-[12px] font-black text-[#24345f]">
                  Özel Not
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
                  placeholder="Tedarikçi hakkında notlar"
                />
              </div>
            </FormSection>

            {error ? (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-bold text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-blue-100 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Kaydediliyor..." : "Tedarikçiyi Kaydet"}
              </button>

              <Link
                href="/suppliers"
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-[#24345f] transition hover:bg-slate-50"
              >
                Vazgeç
              </Link>
            </div>
          </form>

          <aside className="space-y-4">
            <section className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[17px] font-black text-[#0f1f4d]">
                        Kayıt Özeti
                      </h2>
                      <p className="mt-1 text-[12px] font-medium text-slate-500">
                        Kaydetmeden önce bilgileri kontrol edin.
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Truck size={22} strokeWidth={2.4} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Tedarikçi
                    </p>
                    <p className="mt-2 truncate text-[15px] font-black text-[#0f1f4d]">
                      {form.companyName || form.name || "Ad girilmedi"}
                    </p>
                    <p className="mt-1 truncate text-[12px] font-medium text-slate-500">
                      {form.category || "Kategori belirtilmedi"}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <SummaryLine
                      label="Yetkili"
                      value={form.contactName || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Telefon"
                      value={form.phone || form.mobilePhone || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="E-posta"
                      value={form.email || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Vergi No"
                      value={form.taxNumber || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Şehir"
                      value={form.city || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Açılış Bakiyesi"
                      value={`${form.openingBalance || "0"} ${form.currency}`}
                    />
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                        <CheckCircle2 size={17} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-[13px] font-black text-[#0f1f4d]">
                          Hızlı kayıt hazır
                        </p>
                        <p className="mt-1 text-[11px] font-medium leading-5 text-emerald-700">
                          Tedarikçi adı veya firma adı girildiğinde kayıt
                          oluşturulabilir. Eksik bilgileri detay ekranından
                          tamamlayabilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <InfoPanel />
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function FormSection({
  title,
  description,
  icon,
  iconClass,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              iconClass,
            ].join(" ")}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">{title}</h2>
            <p className="text-[12px] font-medium text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: ReactNode;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>
      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          className={[
            "h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
            error
              ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
              : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
          ].join(" ")}
          placeholder={placeholder}
        />
      </div>
      {error ? (
        <p className="mt-2 text-[11px] font-bold text-rose-500">{error}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  icon,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">{label}</label>
      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
        >
          {options.map((option) => (
            <option key={option.value || "empty"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function TopMiniCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  color: "emerald" | "blue" | "violet";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="flex min-w-[150px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          colorMap[color],
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="truncate text-[13px] font-black text-[#0f1f4d]">{value}</p>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[12px]">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="max-w-[160px] truncate text-right font-black text-[#0f1f4d]">
        {value}
      </span>
    </div>
  );
}

function InfoPanel() {
  const items = [
    {
      title: "Cari takip için temel kayıt",
      description:
        "Tedarikçi oluşturulduktan sonra gider, ödeme ve stok hareketlerine bağlanabilir.",
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Vergi bilgileri sonradan eklenebilir",
      description:
        "Gider ve fatura süreçlerinde eksik vergi bilgileri tamamlanabilir.",
      icon: ReceiptText,
      color: "bg-violet-50 text-violet-600",
    },
    {
      title: "Kategori ile segmentasyon",
      description:
        "Hammadde, lojistik veya hizmet gibi kategoriler raporlamada işe yarar.",
      icon: ShieldCheck,
      color: "bg-blue-50 text-blue-600",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">Kısa Bilgiler</h3>
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3">
              <div
                className={[
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  item.color,
                ].join(" ")}
              >
                <Icon size={17} strokeWidth={2.4} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-black text-[#0f1f4d]">{item.title}</p>
                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-500">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
