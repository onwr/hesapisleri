"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/redirect-utils";
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
  authInputClassName,
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

const TRANSITION_MIN_MS = 1000;
const DEMO_EMAIL = "owner@demo.com";
const DEMO_PASSWORD = "123456";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = sanitizeRedirectPath(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [loaderPreset, setLoaderPreset] = useState<LoadingPreset>("login");

  function fillDemoCredentials() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const loaderStartedAt = Date.now();

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
        setLoading(false);
        return;
      }

      setLoaderPreset("loginRedirect");

      const elapsed = Date.now() - loaderStartedAt;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, TRANSITION_MIN_MS - elapsed))
      );

      const defaultPath =
        data.data?.user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard";

      router.push(redirectPath ?? defaultPath);
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
                className={authInputClassName}
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
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={authInputWithToggleClassName}
                disabled={loading || transitioning}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading || transitioning}
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

          <Button
            type="submit"
            disabled={loading || transitioning}
            className={authPrimaryButtonClassName}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
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
