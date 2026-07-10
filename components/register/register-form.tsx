"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authInputWithIconClassName,
  authInputWithToggleClassName,
  authPrimaryButtonClassName,
  authFlatFormClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import { ReferralSignupNotice } from "@/components/register/referral-signup-notice";
import { KvkkAydinlatmaModal } from "@/components/legal/kvkk-aydinlatma-modal";
import type { PublicReferralSignupInfo } from "@/lib/partner-service";
import type { LoadingPreset } from "@/lib/loading-presets";
import {
  KVKK_AYDINLATMA_PATH,
} from "@/lib/legal/kvkk-consent";
import { PRIVACY_POLICY_PATH } from "@/lib/legal/privacy-policy";
import type { CompanyLegalInfo } from "@/lib/legal/company-legal-info";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/auth/register-schema";

const TRANSITION_MIN_MS = 1000;

type FormState = {
  name: string;
  email: string;
  password: string;
  companyName: string;
};

type RegisterFormProps = {
  referral?: PublicReferralSignupInfo | null;
  legalInfo: CompanyLegalInfo;
  trialDays: number;
  marketingConsentText: string;
  registrationEnabled: boolean;
};

export function RegisterForm({
  referral = null,
  legalInfo,
  trialDays,
  marketingConsentText,
  registrationEnabled,
}: RegisterFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [loaderPreset, setLoaderPreset] = useState<LoadingPreset>("register");

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    companyName: "",
  });
  const [kvkkInformed, setKvkkInformed] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [kvkkModalOpen, setKvkkModalOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function updateForm(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function openKvkkModal() {
    if (loading || transitioning) return;
    setKvkkModalOpen(true);
  }

  function handleKvkkCheckboxChange(checked: boolean | "indeterminate") {
    if (checked === true) {
      openKvkkModal();
      return;
    }
    setKvkkInformed(false);
  }

  function validate(): boolean {
    const parsed = registerSchema.safeParse({
      name: form.name,
      email: form.email,
      password: form.password,
      wantsCompanyInfo: true,
      companyName: form.companyName,
      kvkkInformed,
      marketingConsent,
    });

    if (parsed.success) {
      setFieldErrors({});
      setError("");
      return true;
    }

    const flattened = parsed.error.flatten().fieldErrors;
    setFieldErrors({
      name: flattened.name?.[0],
      email: flattened.email?.[0],
      password: flattened.password?.[0],
      companyName: flattened.companyName?.[0],
    });

    if (flattened.kvkkInformed?.[0]) {
      setError(flattened.kvkkInformed[0]);
    } else {
      setError("Bilgileri kontrol edin.");
    }
    return false;
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading || transitioning) return; // double submit engeli
    if (!validate()) return;

    setLoading(true);
    setError("");

    const loaderStartedAt = Date.now();
    setTransitioning(true);
    setLoaderPreset("register");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          wantsCompanyInfo: true,
          companyName: form.companyName.trim(),
          kvkkInformed: true as const,
          marketingConsent,
          referralCode: referral?.referralCode ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setTransitioning(false);
        setError(data.message || "Kayıt oluşturulamadı.");
        if (data.errors) {
          setFieldErrors({
            name: data.errors.name?.[0],
            email: data.errors.email?.[0],
            password: data.errors.password?.[0],
            companyName: data.errors.companyName?.[0],
          });
        }
        setLoading(false);
        return;
      }

      setLoaderPreset("registerRedirect");

      const elapsed = Date.now() - loaderStartedAt;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, TRANSITION_MIN_MS - elapsed))
      );

      router.push("/onboarding");
      router.refresh();
    } catch {
      setTransitioning(false);
      setError("Sunucuya bağlanırken bir hata oluştu.");
      setLoading(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {transitioning ? <AppLoadingScreen preset={loaderPreset} /> : null}
      </AnimatePresence>

      <KvkkAydinlatmaModal
        open={kvkkModalOpen}
        onOpenChange={setKvkkModalOpen}
        onAcknowledge={() => setKvkkInformed(true)}
        legalInfo={legalInfo}
      />

      <div className={authFlatFormClassName}>
        <div className="mb-8">
          <img
            src="/logo.svg"
            alt="Hesapişleri"
            className="mb-6 h-11 w-auto"
          />
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
            {trialDays} gün ücretsiz deneme
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-[#0f1f4d]">
            İşletmenizi dijital olarak yönetmeye başlayın
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Satış, stok, fatura, kasa ve müşteri takibini tek panelden yönetin.
          </p>
        </div>

        {referral ? <ReferralSignupNotice referral={referral} /> : null}

        {!registrationEnabled ? (
          <p className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
            Yeni kayıtlar geçici olarak kapalı. Sorularınız için{" "}
            <a href={`mailto:${legalInfo.kvkkEmail}`} className="underline">
              {legalInfo.kvkkEmail}
            </a>
            .
          </p>
        ) : null}

        <form onSubmit={handleRegister} noValidate className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold text-[#24345f]">
              Ad Soyad
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                className={authInputWithIconClassName}
                placeholder="Ahmet Yılmaz"
                disabled={loading || transitioning}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
            </div>
            {fieldErrors.name ? (
              <p id="name-error" className="text-xs font-semibold text-red-600">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold text-[#24345f]">
              E-posta
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                className={authInputWithIconClassName}
                placeholder="ornek@mail.com"
                disabled={loading || transitioning}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
            </div>
            {fieldErrors.email ? (
              <p id="email-error" className="text-xs font-semibold text-red-600">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-bold text-[#24345f]"
            >
              Şifre
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                className={authInputWithToggleClassName}
                placeholder="En az 8 karakter"
                disabled={loading || transitioning}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading || transitioning}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {fieldErrors.password ? (
              <p id="password-error" className="text-xs font-semibold text-red-600">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="companyName"
              className="text-sm font-bold text-[#24345f]"
            >
              Firma Adı
            </Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => updateForm("companyName", e.target.value)}
                className={authInputWithIconClassName}
                placeholder="Örnek Ticaret Ltd. Şti."
                disabled={loading || transitioning}
                aria-invalid={Boolean(fieldErrors.companyName)}
                aria-describedby={fieldErrors.companyName ? "companyName-error" : undefined}
              />
            </div>
            {fieldErrors.companyName ? (
              <p id="companyName-error" className="text-xs font-semibold text-red-600">
                {fieldErrors.companyName}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
              <Checkbox
                id="kvkkInformed"
                checked={kvkkInformed}
                onCheckedChange={handleKvkkCheckboxChange}
                disabled={loading || transitioning}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="kvkkInformed"
                className="min-w-0 flex-1 cursor-pointer text-xs font-normal leading-relaxed text-slate-600 block!"
              >
                Kişisel Verilerin İşlenmesine İlişkin{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openKvkkModal();
                  }}
                  className="font-semibold text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline"
                >
                  Aydınlatma Metni
                </button>
                &apos;ni okudum ve bilgilendirildim.
              </Label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
              <Checkbox
                id="marketingConsent"
                checked={marketingConsent}
                onCheckedChange={(checked) =>
                  setMarketingConsent(checked === true)
                }
                disabled={loading || transitioning}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="marketingConsent"
                className="min-w-0 flex-1 cursor-pointer text-xs font-normal leading-relaxed text-slate-600 block!"
              >
                {marketingConsentText}
              </Label>
            </div>
          </div>

          <AuthAlert message={error} />

          <Button
            type="submit"
            disabled={loading || transitioning || !kvkkInformed || !registrationEnabled}
            className={authPrimaryButtonClassName}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Hesap Oluştur
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          <Link
            href={KVKK_AYDINLATMA_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-500 hover:text-slate-700"
          >
            Aydınlatma metnini ayrı sayfada görüntüle
          </Link>
          {" · "}
          <Link
            href={PRIVACY_POLICY_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-500 hover:text-slate-700"
          >
            Gizlilik Politikası
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-slate-500">
          Zaten hesabınız var mı?{" "}
          <Link
            href="/login"
            className="font-black text-blue-600 hover:text-blue-700"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
    </>
  );
}
