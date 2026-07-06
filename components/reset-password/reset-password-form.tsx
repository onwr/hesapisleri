"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authInputWithToggleClassName,
  authPrimaryButtonClassName,
  authFlatFormClassName,
} from "@/components/auth/auth-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TokenState = "checking" | "valid" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }

    let cancelled = false;
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTokenState(data.success ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setTokenState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Şifre güncellenemedi.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setIsSubmitting(false);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
      setIsSubmitting(false);
    }
  }

  if (tokenState === "checking") {
    return (
      <div className={authFlatFormClassName}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Bağlantı doğrulanıyor…
        </div>
      </div>
    );
  }

  if (tokenState === "invalid") {
    return (
      <div className={authFlatFormClassName}>
        <div className="mb-6">
          <img src="/logo.svg" alt="Hesapişleri" className="mb-6 h-11 w-auto" />
          <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
            Bağlantı geçersiz veya süresi dolmuş
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Yeni bir şifre sıfırlama bağlantısı isteyebilirsiniz.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="font-black text-blue-600 hover:text-blue-700"
        >
          Yeniden bağlantı iste
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className={authFlatFormClassName}>
        <div className="mb-6">
          <img src="/logo.svg" alt="Hesapişleri" className="mb-6 h-11 w-auto" />
          <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
            Şifreniz güncellendi
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Giriş sayfasına yönlendiriliyorsunuz…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={authFlatFormClassName}>
      <div className="mb-8">
        <img src="/logo.svg" alt="Hesapişleri" className="mb-6 h-11 w-auto" />
        <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
          Yeni şifre belirleyin
        </h2>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-bold text-[#24345f]">
            Yeni şifre
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="En az 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputWithToggleClassName}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={isSubmitting}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-bold text-[#24345f]">
            Yeni şifre (tekrar)
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authInputWithToggleClassName}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <AuthAlert message={error} />

        <Button type="submit" disabled={isSubmitting} className={authPrimaryButtonClassName}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Kaydediliyor…
            </>
          ) : (
            <>
              Şifreyi Güncelle
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
