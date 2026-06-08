"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authInputClassName,
  authInputWithToggleClassName,
  authPrimaryButtonClassName,
  authFlatFormClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import type { LoadingPreset } from "@/lib/loading-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TRANSITION_MIN_MS = 1000;
const TRIAL_DAYS = 14;

type FormState = {
  name: string;
  email: string;
  password: string;
  companyName: string;
};

export function RegisterForm() {
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

  function updateForm(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function validate(): string | null {
    if (form.name.trim().length < 2) {
      return "Ad soyad en az 2 karakter olmalıdır.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return "Geçerli bir e-posta girin.";
    }
    if (form.password.length < 6) {
      return "Şifre en az 6 karakter olmalıdır.";
    }
    if (form.companyName.trim().length < 2) {
      return "Firma adı en az 2 karakter olmalıdır.";
    }
    return null;
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

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
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setTransitioning(false);
        setError(data.message || "Kayıt oluşturulamadı.");
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

      <div className={authFlatFormClassName}>
        <div className="mb-8">
          <img
            src="/logo.svg"
            alt="Hesapişleri"
            className="mb-6 h-11 w-auto"
          />
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
            {TRIAL_DAYS} gün ücretsiz deneme
          </span>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-[#0f1f4d]">
            İşletmenizi dijital olarak yönetmeye başlayın
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Satış, stok, fatura, kasa ve müşteri takibini tek panelden yönetin.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
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
                className={authInputClassName}
                placeholder="Ahmet Yılmaz"
                disabled={loading || transitioning}
                required
              />
            </div>
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
                className={authInputClassName}
                placeholder="ornek@mail.com"
                disabled={loading || transitioning}
                required
              />
            </div>
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
                placeholder="En az 6 karakter"
                disabled={loading || transitioning}
                required
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
                className={authInputClassName}
                placeholder="Örnek Ticaret Ltd. Şti."
                disabled={loading || transitioning}
                required
              />
            </div>
          </div>

          <AuthAlert message={error} />

          <Button
            type="submit"
            disabled={loading || transitioning}
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
