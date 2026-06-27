"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  LogOut,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";
import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  authFlatFormClassName,
  authInputWithIconClassName,
  authInputWithTogglePlainClassName,
  authPrimaryButtonClassName,
  authPrimaryButtonInlineClassName,
} from "@/components/auth/auth-styles";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";
import type { InvitePreviewMode } from "@/lib/invite-preview-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InvitePreview = {
  inviteId: string;
  companyId: string;
  companyName: string;
  email: string;
  role: string;
  roleLabel: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  isLoggedIn: boolean;
  loggedInEmail: string | null;
  emailMatches: boolean;
  accountExists: boolean;
  canAccept: boolean;
  mode: InvitePreviewMode;
};

export function InviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [declined, setDeclined] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginRedirect = `/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`;

  async function loadPreview() {
    if (!token) {
      setError("Davet kodu bulunamadı.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/invites/preview?token=${encodeURIComponent(token)}`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Davet bulunamadı.");
        setPreview(null);
        return;
      }

      setPreview(json.data);
    } catch {
      setError("Davet bilgisi yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, [token]);

  async function handleAccept(body?: { name?: string; password?: string }) {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: body?.name,
          password: body?.password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.code === "LOGIN_REQUIRED") {
          router.push(loginRedirect);
          return;
        }
        setError(json.message || "Davet kabul edilemedi.");
        return;
      }

      router.push(json.data?.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Davet kabul edilirken bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/invites/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Davet reddedilemedi.");
        return;
      }

      setDeclined(true);
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              mode: "rejected",
              canAccept: false,
              status: "REJECTED",
            }
          : prev
      );
    } catch {
      setError("Davet reddedilirken bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogoutAndLogin() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(loginRedirect);
    router.refresh();
  }

  if (loading) {
    return <AppLoadingScreen preset="login" />;
  }

  return (
    <AuthShell variant="invite" maxWidth="lg">
      <div className={authFlatFormClassName}>
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-100">
          <UserPlus size={26} />
        </div>

        <h1 className="text-2xl font-black tracking-tight text-[#0f1f4d]">
          Şirket Daveti
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Daveti inceleyin ve ekibe katılmak isteyip istemediğinize karar verin.
        </p>

        {preview ? (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
            <p>
              <span className="font-black text-[#0f1f4d]">
                {preview.companyName}
              </span>{" "}
              sizi{" "}
              <span className="font-black text-blue-700">
                {preview.roleLabel}
              </span>{" "}
              rolüyle ekibe davet etti.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Davet e-postası: {preview.email}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5">
            <AuthAlert message={error} />
          </div>
        ) : null}

        {declined || preview?.mode === "rejected" ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="flex items-center gap-2 text-base font-black text-[#0f1f4d]">
                <XCircle size={18} className="text-slate-500" />
                Davet reddedildi
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {preview?.companyName ?? "Şirket"} davetini reddettiniz. İsterseniz
                panelden çıkış yapıp doğru hesapla tekrar giriş yapabilirsiniz.
              </p>
            </div>
            <Button asChild variant="outline" className="h-12 rounded-2xl">
              <Link href="/login">Giriş sayfasına dön</Link>
            </Button>
          </div>
        ) : preview?.mode === "logged_in_match" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-slate-500">
              {preview.loggedInEmail} hesabıyla giriş yaptınız. Daveti kabul
              ederseniz aktif firmanız {preview.companyName} olur.
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => void handleDecline()}
                className="h-12 min-w-0 flex-1 rounded-2xl border-slate-200 font-bold text-slate-600"
              >
                Reddet
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={() => void handleAccept()}
                className={authPrimaryButtonInlineClassName}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Daveti Kabul Et
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : preview?.mode === "logged_in_mismatch" ? (
          <div className="mt-6 space-y-4">
            <AuthAlert
              message={`Bu davet ${preview.email} adresine gönderilmiş. Şu an ${preview.loggedInEmail} hesabıyla giriş yaptınız.`}
            />
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                disabled={submitting}
                onClick={() => void handleLogoutAndLogin()}
                className={authPrimaryButtonClassName}
              >
                <LogOut className="size-4" />
                Çıkış yap ve doğru hesapla giriş yap
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => void handleDecline()}
                className="h-12 rounded-2xl border-slate-200 font-bold text-slate-600"
              >
                Reddet
              </Button>
            </div>
          </div>
        ) : preview?.mode === "existing_account" ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-slate-500">
              Bu davet <span className="font-bold text-[#0f1f4d]">{preview.email}</span>{" "}
              hesabına gönderildi. Güvenlik için önce giriş yapmanız gerekir.
            </p>
            <Button asChild className={authPrimaryButtonClassName}>
              <Link href={loginRedirect}>
                <LogIn className="size-4" />
                Giriş yap ve kabul et
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void handleDecline()}
              className="h-12 w-full rounded-2xl border-slate-200 font-bold text-slate-600"
            >
              Reddet
            </Button>
          </div>
        ) : preview?.mode === "new_account" ? (
          <div className="mt-6 space-y-5">
            <p className="text-sm leading-6 text-slate-500">
              Bu e-posta için henüz hesap yok. Daveti kabul etmek için hızlıca
              hesap oluşturun.
            </p>

            <div className="space-y-2">
              <Label htmlFor="invite-name" className="text-sm font-bold text-[#24345f]">
                Ad Soyad
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={authInputWithIconClassName}
                  placeholder="Adınız Soyadınız"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="invite-password"
                className="text-sm font-bold text-[#24345f]"
              >
                Şifre
              </Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  className={authInputWithTogglePlainClassName}
                  placeholder="En az 6 karakter"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={submitting}
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

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => void handleDecline()}
                className="h-12 min-w-0 flex-1 rounded-2xl border-slate-200 font-bold text-slate-600"
              >
                Reddet
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void handleAccept({
                    name: name.trim(),
                    password,
                  })
                }
                className={authPrimaryButtonInlineClassName}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Hesap oluştur ve kabul et
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <StatusMessage mode={preview?.mode ?? "invalid"} />
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function StatusMessage({ mode }: { mode: InvitePreviewMode }) {
  const messages: Record<
    Exclude<
      InvitePreviewMode,
      | "logged_in_match"
      | "logged_in_mismatch"
      | "existing_account"
      | "new_account"
      | "rejected"
    >,
    { title: string; body: string; success?: boolean }
  > = {
    expired: {
      title: "Davet süresi dolmuş",
      body: "Bu davet bağlantısının süresi dolmuş. Yöneticinizden yeni davet isteyebilirsiniz.",
    },
    cancelled: {
      title: "Davet iptal edilmiş",
      body: "Bu davet yönetici tarafından iptal edilmiş.",
    },
    already_accepted: {
      title: "Davet zaten kabul edilmiş",
      body: "Bu davet daha önce kabul edilmiş. Giriş yaparak panele devam edebilirsiniz.",
      success: true,
    },
    invalid: {
      title: "Davet geçersiz",
      body: "Bu davet bağlantısı artık kullanılamıyor.",
    },
  };

  const config =
    mode in messages
      ? messages[mode as keyof typeof messages]
      : messages.invalid;

  return (
    <div className="space-y-4">
      <div
        className={[
          "rounded-2xl border p-5",
          config.success
            ? "border-emerald-100 bg-emerald-50/80"
            : "border-slate-200 bg-slate-50",
        ].join(" ")}
      >
        <p className="flex items-center gap-2 text-base font-black text-[#0f1f4d]">
          {config.success ? (
            <CheckCircle2 size={18} className="text-emerald-600" />
          ) : (
            <XCircle size={18} className="text-slate-500" />
          )}
          {config.title}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{config.body}</p>
      </div>
      {config.success ? (
        <Button asChild className={authPrimaryButtonClassName}>
          <Link href="/login">
            Giriş Yap
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="h-12 rounded-2xl">
          <Link href="/login">Giriş sayfasına dön</Link>
        </Button>
      )}
    </div>
  );
}
