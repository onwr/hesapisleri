"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string; // honeypot — kullanıcıya görünmez
};

const initialState: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    if (!consent) {
      setError("Aydınlatma metnini onaylamalısınız.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Mesaj gönderilemedi.");
        if (data.errors) {
          setFieldErrors({
            name: data.errors.name?.[0],
            email: data.errors.email?.[0],
            subject: data.errors.subject?.[0],
            message: data.errors.message?.[0],
          });
        }
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
      setIsSubmitting(false);
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu. Lütfen tekrar deneyin.");
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-8 text-center">
        <p className="font-bold text-emerald-800">Mesajınız alındı.</p>
        <p className="mt-1 text-sm text-emerald-700">En kısa sürede size dönüş yapacağız.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Honeypot — CSS ile gizli, gerçek kullanıcı görmez/doldurmaz */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(e) => updateField("website", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="text-sm font-bold text-slate-700">
            Ad Soyad
          </label>
          <input
            id="contact-name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          {fieldErrors.name ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="contact-email" className="text-sm font-bold text-slate-700">
            E-posta
          </label>
          <input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          />
          {fieldErrors.email ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.email}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-subject" className="text-sm font-bold text-slate-700">
          Konu
        </label>
        <input
          id="contact-subject"
          value={form.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        />
        {fieldErrors.subject ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.subject}</p> : null}
      </div>

      <div>
        <label htmlFor="contact-message" className="text-sm font-bold text-slate-700">
          Mesaj
        </label>
        <textarea
          id="contact-message"
          rows={5}
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          disabled={isSubmitting}
          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        />
        {fieldErrors.message ? <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.message}</p> : null}
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        Kişisel verilerimin bu talebi yanıtlamak amacıyla işlenmesini kabul ediyorum.
      </label>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Gönderiliyor…
          </>
        ) : (
          <>
            Mesaj Gönder
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}
