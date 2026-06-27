"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authInputWithIconClassName,
  authInputWithToggleClassName,
  authPrimaryButtonClassName,
  authFlatFormClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import type { LoadingPreset } from "@/lib/loading-presets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REDIRECT_TIMEOUT_MS = 12_000;
const DEMO_EMAIL = "owner@demo.com";
const DEMO_PASSWORD = "123456";

type LoginFormProps = {
  sessionExpired?: boolean;
};

export function LoginForm({ sessionExpired = false }: LoginFormProps) {
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? searchParams.get("redirect");
  const redirectPath = nextParam
    ? sanitizeAuthRedirectPath(nextParam)
    : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(
    sessionExpired
      ? "Oturumunuz sona erdi. Lütfen tekrar giriş yapın."
      : ""
  );
  const [transitioning, setTransitioning] = useState(false);
  const [loaderPreset, setLoaderPreset] = useState<LoadingPreset>("login");
  const [redirectTimedOut, setRedirectTimedOut] = useState(false);
  const [pendingRedirectTo, setPendingRedirectTo] = useState<string | null>(
    null
  );
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  function clearRedirectTimeout() {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }

  function startRedirect(redirectTo: string) {
    setPendingRedirectTo(redirectTo);
    setTransitioning(true);
    setLoaderPreset("loginRedirect");
    setRedirectTimedOut(false);
    clearRedirectTimeout();

    redirectTimeoutRef.current = window.setTimeout(() => {
      setRedirectTimedOut(true);
    }, REDIRECT_TIMEOUT_MS);

    window.location.replace(redirectTo);
  }

  function fillDemoCredentials() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setRedirectTimedOut(false);
    setTransitioning(true);
    setLoaderPreset("login");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setTransitioning(false);
        setError(data.message || "Giriş yapılamadı.");
        setIsSubmitting(false);
        return;
      }

      const defaultPath =
        data.redirectTo ??
        data.data?.redirectTo ??
        (data.data?.user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");

      const destination = redirectPath ?? defaultPath;
      startRedirect(destination);
    } catch {
      setTransitioning(false);
      setError("Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.");
      setIsSubmitting(false);
    }
  }

  const submitLabel = isSubmitting
    ? transitioning && loaderPreset === "loginRedirect"
      ? "Panel açılıyor…"
      : "Giriş yapılıyor…"
    : "Giriş Yap";

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
          <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
            Hesapişleri&apos;ne giriş yapın
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Satış, stok, fatura ve finans yönetiminize kaldığınız yerden devam
            edin.
          </p>
        </div>

        <button
          type="button"
          onClick={fillDemoCredentials}
          className="mb-6 flex w-full items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-left transition hover:bg-blue-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-wide text-blue-700">
              Demo giriş
            </p>
            <p className="mt-1 text-sm font-bold text-[#0f1f4d]">
              {DEMO_EMAIL}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <KeyRound size={12} />
              Şifre: {DEMO_PASSWORD}
            </p>
          </div>
        </button>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-bold text-[#24345f]">
              E-posta
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ornek@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputWithIconClassName}
                disabled={isSubmitting}
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
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputWithToggleClassName}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
                className="rounded-md border-slate-300 data-checked:border-blue-600 data-checked:bg-blue-600"
              />
              <Label
                htmlFor="remember"
                className="cursor-pointer text-sm font-medium text-slate-600"
              >
                Beni hatırla
              </Label>
            </div>
          </div>

          <AuthAlert message={error} />

          {redirectTimedOut && pendingRedirectTo ? (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Yönlendirme beklenenden uzun sürdü.
              </p>
              <Button
                type="button"
                className={authPrimaryButtonClassName}
                onClick={() => window.location.replace(pendingRedirectTo)}
              >
                Panele Git
              </Button>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={authPrimaryButtonClassName}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {submitLabel}
              </>
            ) : (
              <>
                Giriş Yap
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Hesabınız yok mu?{" "}
          <Link
            href="/register"
            className="font-black text-blue-600 hover:text-blue-700"
          >
            Kayıt olun
          </Link>
        </p>
      </div>
    </>
  );
}
