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
  User,
  Users,
  Wallet,
} from "lucide-react";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { CustomerGroupSelect } from "@/components/customers/customer-group-select";
import {
  CustomerTaxCertificateField,
  createEmptyTaxCertificateValue,
  type TaxCertificateFormValue,
} from "@/components/customers/customer-tax-certificate-field";
import {
  buildCustomerPayload,
  getFirstCustomerErrorMessage,
  mapCustomerFieldErrors,
} from "@/lib/customer-form-utils";

import { resolvePostCreateRedirect } from "@/lib/onboarding/onboarding-routes";

export function NewCustomerPageClient({
  returnTo = null,
}: {
  returnTo?: string | null;
}) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    taxNo: "",
    taxOffice: "",
    address: "",
    group: "Genel",
    ...createEmptyTaxCertificateValue(),
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
      const res = await fetch("/api/customers/create", {
        method: "POST",
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
            "Müşteri oluşturulamadı."
        );
        return;
      }

      const customerId = data.data?.id as string | undefined;
      const defaultDestination = customerId
        ? `/customers/${customerId}?created=1`
        : "/customers";
      router.push(
        resolvePostCreateRedirect({
          returnTo,
          defaultDestination,
        })
      );
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  const filledFields = Object.values(form).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-5 py-6">
      {saving ? (
        <AppLoadingScreen
          preset="customers"
          title="Müşteri kaydediliyor"
          subtitle="Bilgileriniz kaydediliyor..."
        />
      ) : null}

      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/customers"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0f1f4d] transition hover:bg-slate-50"
              >
                <ArrowLeft size={18} strokeWidth={2.6} />
              </Link>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-600">
                  <Sparkles size={14} strokeWidth={2.5} />
                  Yeni Müşteri Kaydı
                </div>

                <h1 className="text-[26px] font-black tracking-[-0.04em] text-[#0f1f4d]">
                  Müşteri Bilgileri
                </h1>

                <p className="mt-1 max-w-2xl text-[13px] font-medium leading-6 text-slate-500">
                  Müşteri veya firma bilgilerini girin. Sadece müşteri adı
                  zorunludur, diğer alanları daha sonra tamamlayabilirsiniz.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TopMiniCard
                label="Durum"
                value="Yeni Kayıt"
                icon={<Users size={17} />}
                color="blue"
              />

              <TopMiniCard
                label="Zorunlu Alan"
                value="Müşteri Adı"
                icon={<CheckCircle2 size={17} />}
                color="emerald"
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
            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <User size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Temel Bilgiler
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Müşteriyi sistemde tanımlamak için gerekli bilgiler.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <InputField
                    label="Müşteri / Firma Adı"
                    required
                    icon={<User size={18} />}
                    value={form.name}
                    onChange={(value) => updateForm("name", value)}
                    placeholder="Örnek Müşteri / Firma"
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
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Phone size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      İletişim
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Telefon ve e-posta bilgileri.
                    </p>
                  </div>
                </div>
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
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <ReceiptText size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Vergi Bilgileri
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Vergi numarası, vergi dairesi ve vergi levhası.
                    </p>
                  </div>
                </div>
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
                  icon={<Building2 size={18} />}
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
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <MapPin size={20} strokeWidth={2.4} />
                  </div>

                  <div>
                    <h2 className="text-[16px] font-black text-[#0f1f4d]">
                      Adres / Notlar
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500">
                      Fatura ve teslimat süreçlerinde kullanılabilir.
                    </p>
                  </div>
                </div>
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
                {saving ? "Kaydediliyor..." : "Müşteriyi Kaydet"}
              </button>

              <Link
                href="/customers"
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

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <User size={22} strokeWidth={2.4} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Müşteri
                    </p>

                    <p className="mt-2 truncate text-[15px] font-black text-[#0f1f4d]">
                      {form.name || "Müşteri adı girilmedi"}
                    </p>

                    <p className="mt-1 truncate text-[12px] font-medium text-slate-500">
                      {form.group || "Grup belirtilmedi"}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <SummaryLine
                      label="Telefon"
                      value={form.phone || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="E-posta"
                      value={form.email || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Vergi / T.C."
                      value={form.taxNo || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Vergi Dairesi"
                      value={form.taxOffice || "Belirtilmedi"}
                    />
                    <SummaryLine
                      label="Vergi Levhası"
                      value={
                        form.taxCertificateUrl
                          ? form.taxCertificateFileName || "Yüklendi"
                          : "Belirtilmedi"
                      }
                    />
                    <SummaryLine
                      label="Adres"
                      value={form.address ? "Girildi" : "Belirtilmedi"}
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
                          Müşteri adı girildiğinde kayıt oluşturulabilir. Eksik
                          bilgileri daha sonra müşteri detayından
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

        <p className="truncate text-[13px] font-black text-[#0f1f4d]">
          {value}
        </p>
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
        "Müşteri oluşturulduktan sonra satış, fatura ve tahsilat süreçlerine bağlanabilir.",
      icon: Wallet,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Vergi bilgileri sonradan eklenebilir",
      description:
        "Fatura kesme aşamasında eksik vergi veya adres bilgileri tamamlanabilir.",
      icon: ReceiptText,
      color: "bg-violet-50 text-violet-600",
    },
    {
      title: "Grup ile segmentasyon",
      description:
        "Perakende, toptan veya kurumsal gibi gruplar raporlama tarafında işe yarar.",
      icon: ShieldCheck,
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
        Kısa Bilgiler
      </h3>

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
                <p className="text-[12px] font-black text-[#0f1f4d]">
                  {item.title}
                </p>
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