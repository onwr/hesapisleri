"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

const audienceOptions = [
  { value: "BUSINESS", label: "İşletme Sahibi" },
  { value: "AGENCY", label: "Ajans" },
  { value: "INFLUENCER", label: "Influencer" },
  { value: "CUSTOMER", label: "Müşteri" },
  { value: "OTHER", label: "Diğer" },
];

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-800 outline-none transition focus:border-[#0f1f4d] focus:ring-2 focus:ring-[#0f1f4d]/10";

export function PartnerApplyForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: defaultEmail,
    phone: "",
    socialUrl: "",
    audienceType: "BUSINESS",
    expectedReach: "",
    message: "",
    termsAccepted: false,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/partner/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          socialUrl: form.socialUrl || undefined,
          phone: form.phone.trim(),
          expectedReach: form.expectedReach || undefined,
          message: form.message || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.message || "Başvuru gönderilemedi.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Başvuru gönderilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
        <h2 className="mt-4 text-[22px] font-extrabold text-emerald-900">
          Başvurunuz Alındı
        </h2>
        <p className="mt-2 text-[14px] text-emerald-800">
          Başvurunuz alındı. İnceleme sonrası durumunuzu{" "}
          <a href="/partnership/status" className="font-bold underline">
            buradan
          </a>{" "}
          takip edebilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            Ad Soyad *
          </span>
          <input
            className={inputClass}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            E-posta *
          </span>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            Telefon *
          </span>
          <input
            className={inputClass}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="05xx xxx xx xx"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            Sosyal medya / web sitesi
          </span>
          <input
            className={inputClass}
            value={form.socialUrl}
            onChange={(e) => setForm({ ...form, socialUrl: e.target.value })}
            placeholder="https://"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            Kitle tipi *
          </span>
          <select
            className={inputClass}
            value={form.audienceType}
            onChange={(e) => setForm({ ...form, audienceType: e.target.value })}
          >
            {audienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
            Tahmini erişim / takipçi
          </span>
          <input
            className={inputClass}
            value={form.expectedReach}
            onChange={(e) =>
              setForm({ ...form, expectedReach: e.target.value })
            }
            placeholder="Örn. 10.000"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-bold text-slate-500">
          Neden ortak olmak istiyorsunuz?
        </span>
        <textarea
          className={`${inputClass} min-h-[120px] resize-y`}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.termsAccepted}
          onChange={(e) =>
            setForm({ ...form, termsAccepted: e.target.checked })
          }
        />
        <span className="text-[13px] text-slate-600">
          KVKK ve ortaklık programı şartlarını okudum, kabul ediyorum.
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 py-3.5 text-[14px] font-bold text-white transition hover:bg-[#162a66] disabled:opacity-60"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
        Başvuruyu Gönder
      </button>
    </form>
  );
}
