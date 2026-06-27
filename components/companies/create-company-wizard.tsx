"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Settings2,
  X,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authFlatFormClassName,
  authInputWithIconClassName,
  authPrimaryButtonClassName,
  authPrimaryButtonInlineClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateCreateCompanyWizardStep } from "@/lib/create-company-api-utils";
import { uploadImageToCdn } from "@/lib/storage/upload-client";
import { usePlatformUploadLimits } from "@/components/platform-runtime/platform-runtime-provider";

const STEPS = [
  { id: 1, label: "Firma bilgileri" },
  { id: 2, label: "Logo & iletişim" },
  { id: 3, label: "Finans ayarları" },
  { id: 4, label: "Özet" },
] as const;

const VAT_OPTIONS = [0, 1, 8, 10, 18, 20] as const;

type FormState = {
  name: string;
  taxNo: string;
  taxOffice: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  currency: "TRY" | "USD" | "EUR";
  defaultVatRate: number;
};

export function CreateCompanyWizard() {
  const { maxImageBytes } = usePlatformUploadLimits();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    taxNo: "",
    taxOffice: "",
    phone: "",
    email: "",
    address: "",
    logoUrl: "",
    currency: "TRY",
    defaultVatRate: 20,
  });

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setSuccess("");
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    setError("");

    try {
      const url = await uploadImageToCdn(file, "hesapisleri/companies", maxImageBytes);
      setLogoPreview(url);
      updateForm("logoUrl", url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Logo CDN'e yüklenemedi."
      );
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  function clearLogo() {
    setLogoPreview(null);
    updateForm("logoUrl", "");
  }

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();

        if (!res.ok || !json.success) {
          router.push("/login");
          return;
        }

        setForm((prev) => ({
          ...prev,
          email: prev.email || json.data?.user.email || "",
        }));
      } catch {
        router.push("/login");
      } finally {
        setPageLoading(false);
      }
    }

    void loadUser();
  }, [router]);

  function goNext() {
    const validationError = validateCreateCompanyWizardStep(step, form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length));
  }

  function goBack() {
    setError("");
    setSuccess("");
    setStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleCreate() {
    const validationError = validateCreateCompanyWizardStep(1, form);
    if (validationError) {
      setError(validationError);
      setStep(1);
      return;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Geçerli bir e-posta girin.");
      setStep(2);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          taxNo: form.taxNo.trim() || undefined,
          taxOffice: form.taxOffice.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          logoUrl: form.logoUrl || undefined,
          currency: form.currency,
          defaultVatRate: form.defaultVatRate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Firma oluşturulamadı.");
        return;
      }

      setSuccess("Firma oluşturuldu ve aktif firma olarak seçildi.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (pageLoading) {
    return <AppLoadingScreen preset="onboarding" />;
  }

  const textareaClassName =
    "min-h-24 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-[#0f1f4d] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50";

  return (
    <>
      {logoUploading ? <AppLoadingScreen preset="imageUpload" /> : null}

      <div className={authFlatFormClassName}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
              Yeni firma
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-[#0f1f4d]">
              Yeni firma oluştur
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Adım {step} / {STEPS.length} — {STEPS[step - 1].label}
            </p>
          </div>
          <Link
            href="/companies/select"
            className="shrink-0 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Vazgeç
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-4 gap-2">
          {STEPS.map((item) => {
            const isActive = item.id === step;
            const isDone = item.id < step;

            return (
              <div key={item.id} className="space-y-2">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition",
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-linear-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-100"
                        : "bg-slate-100 text-slate-400",
                  ].join(" ")}
                >
                  {isDone ? <CheckCircle2 size={16} /> : item.id}
                </div>
                <p
                  className={[
                    "hidden text-[10px] font-bold leading-4 sm:block",
                    isActive ? "text-[#0f1f4d]" : "text-slate-400",
                  ].join(" ")}
                >
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="mb-4">
            <AuthAlert message={error} variant="error" />
          </div>
        ) : null}

        {success ? (
          <div className="mb-4">
            <AuthAlert message={success} variant="success" />
          </div>
        ) : null}

        <div className="space-y-5">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-bold text-[#24345f]">
                  Firma Adı <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    className={authInputWithIconClassName}
                    placeholder="Örnek Ticaret Ltd. Şti."
                    disabled={saving}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    Vergi No / T.C.
                  </Label>
                  <Input
                    value={form.taxNo}
                    onChange={(e) => updateForm("taxNo", e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 text-sm font-medium text-[#0f1f4d]"
                    placeholder="Opsiyonel"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    Vergi Dairesi
                  </Label>
                  <Input
                    value={form.taxOffice}
                    onChange={(e) => updateForm("taxOffice", e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 text-sm font-medium text-[#0f1f4d]"
                    placeholder="Opsiyonel"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-[#24345f]">Adres</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-4 size-4 text-slate-400" />
                  <textarea
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                    className={textareaClassName}
                    placeholder="Firma adresi"
                    disabled={saving}
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-bold text-[#24345f]">
                  Firma Logosu{" "}
                  <span className="font-normal text-slate-400">(opsiyonel)</span>
                </Label>
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Firma logosu"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="text-slate-300" size={28} />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#24345f] transition hover:bg-slate-50 ${logoUploading ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <ImagePlus size={18} className="text-blue-600" />
                      Logo yükle
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                        disabled={saving || logoUploading}
                      />
                    </label>
                    {logoPreview ? (
                      <button
                        type="button"
                        onClick={clearLogo}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700"
                      >
                        <X size={14} />
                        Logoyu kaldır
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    Telefon
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      className={authInputWithIconClassName}
                      placeholder="05xx xxx xx xx"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    E-posta
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      className={authInputWithIconClassName}
                      placeholder="info@firma.com"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-black text-blue-800">
                  <Settings2 size={16} />
                  Finans ayarları
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Para birimi ve KDV oranı satış, fatura ve raporlarda kullanılır.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    Para Birimi
                  </Label>
                  <Select
                    value={form.currency}
                    onValueChange={(value: FormState["currency"]) =>
                      updateForm("currency", value)
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 text-sm font-medium text-[#0f1f4d]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY — Türk Lirası</SelectItem>
                      <SelectItem value="USD">USD — Amerikan Doları</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-[#24345f]">
                    Varsayılan KDV (%)
                  </Label>
                  <Select
                    value={String(form.defaultVatRate)}
                    onValueChange={(value) =>
                      updateForm("defaultVatRate", Number(value))
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 text-sm font-medium text-[#0f1f4d]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_OPTIONS.map((rate) => (
                        <SelectItem key={rate} value={String(rate)}>
                          %{rate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <SummaryRow label="Firma adı" value={form.name.trim() || "—"} />
              <SummaryRow label="Vergi no" value={form.taxNo.trim() || "—"} />
              <SummaryRow
                label="Vergi dairesi"
                value={form.taxOffice.trim() || "—"}
              />
              <SummaryRow label="Adres" value={form.address.trim() || "—"} />
              <SummaryRow label="Telefon" value={form.phone.trim() || "—"} />
              <SummaryRow label="E-posta" value={form.email.trim() || "—"} />
              <SummaryRow label="Para birimi" value={form.currency} />
              <SummaryRow
                label="Varsayılan KDV"
                value={`%${form.defaultVatRate}`}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={saving}
              className="h-12 rounded-2xl border-slate-200 px-5 text-sm font-bold text-slate-600"
            >
              <ArrowLeft size={16} />
              Geri
            </Button>
          ) : (
            <Link
              href="/companies/select"
              className="inline-flex h-12 items-center gap-2 rounded-2xl px-2 text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={16} />
              Firmalara dön
            </Link>
          )}

          {step < STEPS.length ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={saving}
              className={authPrimaryButtonInlineClassName}
            >
              Devam
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
              className={authPrimaryButtonClassName}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                "Firmayı Oluştur"
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-[#0f1f4d]">
        {value}
      </span>
    </div>
  );
}
