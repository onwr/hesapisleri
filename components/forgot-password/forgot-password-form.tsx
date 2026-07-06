"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  authInputWithIconClassName,
  authPrimaryButtonClassName,
  authFlatFormClassName,
} from "@/components/auth/auth-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "İşlem başarısız. Lütfen tekrar deneyin.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(data.message);
      setSubmitted(true);
      setIsSubmitting(false);
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu. Lütfen tekrar deneyin.");
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={authFlatFormClassName}>
        <div className="mb-6">
          <img src="/logo.svg" alt="Hesapişleri" className="mb-6 h-11 w-auto" />
          <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
            Bağlantı gönderildi
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{successMessage}</p>
        </div>
        <Link href="/login" className="font-black text-blue-600 hover:text-blue-700">
          Giriş sayfasına dön
        </Link>
      </div>
    );
  }

  return (
    <div className={authFlatFormClassName}>
      <div className="mb-8">
        <img src="/logo.svg" alt="Hesapişleri" className="mb-6 h-11 w-auto" />
        <h2 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
          Şifrenizi mi unuttunuz?
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
            />
          </div>
        </div>

        <AuthAlert message={error} />

        <Button type="submit" disabled={isSubmitting} className={authPrimaryButtonClassName}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Gönderiliyor…
            </>
          ) : (
            <>
              Sıfırlama Bağlantısı Gönder
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-black text-blue-600 hover:text-blue-700">
          Giriş sayfasına dön
        </Link>
      </p>
    </div>
  );
}
