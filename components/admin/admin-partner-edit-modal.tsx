"use client";

import { useEffect, useState } from "react";
import { adminPartnerUpdateSchema } from "@/lib/admin/partners/admin-partner-schemas";
import { appOutlineButtonClass, appPrimaryButtonClass } from "@/lib/admin-ui";

type PartnerShape = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  referralCode: string;
  commissionRate: number;
  badgeType: string;
  accountHolderName?: string | null;
  taxNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  payoutMethod?: string | null;
  status: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  partner: PartnerShape;
  onSuccess: (msg: string) => void;
};

const BADGE_OPTIONS = [
  { value: "NONE", label: "Yok" },
  { value: "PARTNER", label: "Partner" },
  { value: "VERIFIED", label: "Doğrulanmış" },
  { value: "INFLUENCER", label: "Influencer" },
  { value: "CELEBRITY", label: "Ünlü" },
  { value: "VIP", label: "VIP" },
] as const;

export function AdminPartnerEditModal({ open, onClose, partner, onSuccess }: Props) {
  const [fullName, setFullName] = useState(partner.fullName);
  const [email, setEmail] = useState(partner.email);
  const [phone, setPhone] = useState(partner.phone ?? "");
  const [referralCode, setReferralCode] = useState(partner.referralCode);
  const [commissionRate, setCommissionRate] = useState(partner.commissionRate);
  const [badgeType, setBadgeType] = useState(partner.badgeType);
  const [accountHolderName, setAccountHolderName] = useState(partner.accountHolderName ?? "");
  const [taxNumber, setTaxNumber] = useState(partner.taxNumber ?? "");
  const [iban, setIban] = useState(partner.iban ?? "");
  const [bankName, setBankName] = useState(partner.bankName ?? "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = partner.status === "ARCHIVED";

  useEffect(() => {
    if (!open) return;
    setFullName(partner.fullName);
    setEmail(partner.email);
    setPhone(partner.phone ?? "");
    setReferralCode(partner.referralCode);
    setCommissionRate(partner.commissionRate);
    setBadgeType(partner.badgeType);
    setAccountHolderName(partner.accountHolderName ?? "");
    setTaxNumber(partner.taxNumber ?? "");
    setIban(partner.iban ?? "");
    setBankName(partner.bankName ?? "");
    setReason("");
    setError(null);
  }, [open, partner]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || readOnly) return;
    setLoading(true);
    setError(null);

    const parsed = adminPartnerUpdateSchema.safeParse({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      referralCode: referralCode.trim(),
      commissionRate,
      badgeType,
      accountHolderName: accountHolderName.trim() || null,
      taxNumber: taxNumber.trim() || null,
      iban: iban.trim() || null,
      bankName: bankName.trim() || null,
      reason: reason.trim(),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Form doğrulaması başarısız.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message ?? "Güncellenemedi.");
        return;
      }
      onSuccess(json.message ?? "Partner güncellendi.");
    } catch {
      setError("İstek başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
      >
        <h3 className="text-[14px] font-bold text-slate-900">Partner düzenle</h3>
        {readOnly ? (
          <p className="mt-2 text-[12px] text-amber-700">Arşivlenmiş partner düzenlenemez.</p>
        ) : null}
        <div className="mt-4 space-y-3 text-[12px]">
          <label className="block">
            Ad
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={readOnly}
            />
          </label>
          <label className="block">
            E-posta
            <input
              type="email"
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Telefon
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Referans kodu
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              required
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Komisyon oranı (%)
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              required
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Rozet tipi
            <select
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={badgeType}
              onChange={(e) => setBadgeType(e.target.value)}
              disabled={readOnly}
            >
              {BADGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Hesap sahibi
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Vergi no
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              disabled={readOnly}
            />
          </label>
          <label className="block">
            IBAN
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Banka
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              disabled={readOnly}
            />
          </label>
          <label className="block">
            Değişiklik sebebi
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={readOnly}
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose} disabled={loading}>
            İptal
          </button>
          <button type="submit" className={appPrimaryButtonClass} disabled={loading || readOnly}>
            {loading ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
