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
  User,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { CustomerGroupSelect } from "@/components/customers/customer-group-select";
import {
  CustomerTaxCertificateField,
  mapTaxCertificateFromCustomer,
  type TaxCertificateFormValue,
} from "@/components/customers/customer-tax-certificate-field";
import {
  buildCustomerPayload,
  getFirstCustomerErrorMessage,
  mapCustomerFieldErrors,
} from "@/lib/customer-form-utils";

type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxNo: string | null;
  taxOffice: string | null;
  taxCertificateUrl: string | null;
  taxCertificateFileName: string | null;
  taxCertificateMimeType: string | null;
  taxCertificateSize: number | null;
  address: string | null;
  group: string | null;
};

export function EditCustomerForm({ customer }: { customer: CustomerRecord }) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone || "",
    email: customer.email || "",
    taxNo: customer.taxNo || "",
    taxOffice: customer.taxOffice || "",
    address: customer.address || "",
    group: customer.group || "Genel",
    ...mapTaxCertificateFromCustomer(customer),
  });

  function updateForm(key: keyof typeof form, value: string | number | null) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateTaxCertificate(value: TaxCertificateFormValue) {
    setForm((prev) => ({
      ...prev,
      ...value,
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const payload = buildCustomerPayload(form);

    if (payload.name.length < 2) {
      setFieldErrors({ name: "Müşteri adı en az 2 karakter olmalıdır." });
      setError("Müşteri adı en az 2 karakter olmalıdır.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFieldErrors(mapCustomerFieldErrors(data.errors));
        setError(
          getFirstCustomerErrorMessage(data.message, data.errors) ||
            "Müşteri güncellenemedi."
        );
        return;
      }

      router.push(`/customers/${customer.id}?updated=1`);
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="customers"
          title="Müşteri güncelleniyor"
          subtitle="Bilgileriniz kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[980px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex items-start gap-4">
            <Link
              href={`/customers/${customer.id}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} strokeWidth={2.6} />
            </Link>

            <div>
              <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                Müşteri Düzenle
              </h1>
              <p className="mt-1 text-[13px] font-medium text-slate-500">
                {customer.name} kaydının bilgilerini güncelleyin.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-[16px] font-black text-[#0f1f4d]">
                Temel Bilgiler
              </h2>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <InputField
                  label="Müşteri / Firma Adı"
                  required
                  icon={<User size={18} />}
                  value={form.name}
                  onChange={(value) => updateForm("name", value)}
                  placeholder="Müşteri adı"
                  error={fieldErrors.name}
                />
              </div>

              <CustomerGroupSelect
                value={form.group}
                onChange={(value) => updateForm("group", value)}
                error={fieldErrors.group}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-[16px] font-black text-[#0f1f4d]">İletişim</h2>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <InputField
                label="Telefon"
                icon={<Phone size={18} />}
                value={form.phone}
                onChange={(value) => updateForm("phone", value)}
                placeholder="05xx xxx xx xx"
                error={fieldErrors.phone}
              />

              <InputField
                label="E-posta"
                type="email"
                icon={<Mail size={18} />}
                value={form.email}
                onChange={(value) => updateForm("email", value)}
                placeholder="ornek@mail.com"
                error={fieldErrors.email}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-[16px] font-black text-[#0f1f4d]">
                Vergi Bilgileri
              </h2>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-2">
              <InputField
                label="Vergi No / TCKN"
                icon={<Building2 size={18} />}
                value={form.taxNo}
                onChange={(value) => updateForm("taxNo", value)}
                placeholder="Opsiyonel"
                error={fieldErrors.taxNo}
              />

              <InputField
                label="Vergi Dairesi"
                icon={<ReceiptText size={18} />}
                value={form.taxOffice}
                onChange={(value) => updateForm("taxOffice", value)}
                placeholder="Örn. Battalgazi Vergi Dairesi"
                error={fieldErrors.taxOffice}
              />

              <div className="md:col-span-2">
                <CustomerTaxCertificateField
                  value={{
                    taxCertificateUrl: form.taxCertificateUrl,
                    taxCertificateFileName: form.taxCertificateFileName,
                    taxCertificateMimeType: form.taxCertificateMimeType,
                    taxCertificateSize: form.taxCertificateSize,
                  }}
                  onChange={updateTaxCertificate}
                  error={fieldErrors.taxCertificateUrl}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-[16px] font-black text-[#0f1f4d]">
                Adres / Notlar
              </h2>
            </div>

            <div className="p-4">
              <label className="text-[12px] font-black text-[#24345f]">
                Adres
              </label>

              <div className="relative mt-2">
                <MapPin
                  size={18}
                  className="absolute left-4 top-4 text-slate-400"
                />

                <textarea
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  className={[
                    "min-h-32 w-full rounded-2xl border bg-white py-3 pl-11 pr-4 text-[13px] font-medium text-[#24345f] outline-none transition placeholder:text-slate-400 focus:ring-4",
                    fieldErrors.address
                      ? "border-rose-300 focus:border-rose-300 focus:ring-rose-50"
                      : "border-slate-200 focus:border-blue-200 focus:ring-blue-50",
                  ].join(" ")}
                  placeholder="Müşteri adresi"
                />
              </div>

              {fieldErrors.address ? (
                <p className="mt-2 text-[11px] font-bold text-rose-500">
                  {fieldErrors.address}
                </p>
              ) : null}
            </div>
          </section>

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
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>

            <Link
              href={`/customers/${customer.id}`}
              className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-black text-[#24345f] transition hover:bg-slate-50"
            >
              Vazgeç
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>

      <div className="relative mt-2">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={required ? 2 : undefined}
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
