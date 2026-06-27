"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  appOutlineButtonClass,
  appPanelClass,
  appPrimaryButtonClass,
  appSelectClass,
  appTableClass,
  appTableHeadClass,
  appTableRowClass,
} from "@/lib/admin-ui";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin-utils";

type PartnerOption = {
  id: string;
  fullName: string;
  referralCode: string;
  status: string;
};

type EarningRow = {
  id: string;
  partnerId: string;
  amount: number;
  currency: string;
  status: string;
  companyName: string | null;
  conversionType: string | null;
  commissionRate: number | null;
  createdAt: string;
};

const CURRENCIES = ["TRY", "USD", "EUR"] as const;

export function AdminPartnerPayoutCreateModal({
  partners,
  minimumPayoutAmount,
  onClose,
}: {
  partners: PartnerOption[];
  minimumPayoutAmount: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState("");
  const [currency, setCurrency] = useState<string>("TRY");
  const [paymentMethod, setPaymentMethod] = useState<"IBAN" | "CASH" | "MANUAL">("MANUAL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [company, setCompany] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadEarnings = useCallback(async () => {
    if (!partnerId) {
      setEarnings([]);
      setSelected(new Set());
      return;
    }
    setLoadingEarnings(true);
    setError("");
    try {
      const params = new URLSearchParams({ partnerId, currency });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (company.trim()) params.set("company", company.trim());
      if (amountMin) params.set("amountMin", amountMin);
      if (amountMax) params.set("amountMax", amountMax);

      const res = await fetch(`/api/admin/partner-payouts/eligible-earnings?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Hak edişler yüklenemedi.");
      setEarnings(json.data.earnings ?? []);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hak edişler yüklenemedi.");
      setEarnings([]);
    } finally {
      setLoadingEarnings(false);
    }
  }, [partnerId, currency, dateFrom, dateTo, company, amountMin, amountMax]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  const selectedEarnings = useMemo(
    () => earnings.filter((e) => selected.has(e.id)),
    [earnings, selected]
  );

  const total = useMemo(
    () => selectedEarnings.reduce((sum, e) => sum + e.amount, 0),
    [selectedEarnings]
  );

  const selectedCurrency = selectedEarnings[0]?.currency ?? currency;

  const belowMinimumThreshold =
    selectedCurrency === "TRY" &&
    minimumPayoutAmount > 0 &&
    selected.size > 0 &&
    total < minimumPayoutAmount;

  const canSubmit =
    !submitting &&
    confirm &&
    reason.trim() &&
    selected.size > 0 &&
    partnerId &&
    !belowMinimumThreshold;

  function toggleEarning(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/partner-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earningIds: [...selected],
          paymentMethod,
          note: note.trim() || undefined,
          reason: reason.trim(),
          confirm: true,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Ödeme oluşturulamadı.");
      onClose();
      router.push(`/admin/partners/payouts/${json.data.payout.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ödeme oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`${appPanelClass} my-4 w-full max-w-4xl space-y-4 p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Payout Oluştur</h2>
            <p className="text-[13px] text-slate-500">Uygun hak edişlerden yeni ödeme taslağı oluşturun.</p>
          </div>
          <button type="button" className={appOutlineButtonClass} onClick={onClose}>
            Kapat
          </button>
        </div>

        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[13px]">
            Partner
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">Seçin…</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.referralCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px]">
            Para birimi
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px]">
            Ödeme yöntemi
            <select
              className={`${appSelectClass} mt-1 w-full`}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "IBAN" | "CASH" | "MANUAL")}
            >
              <option value="MANUAL">Manuel</option>
              <option value="IBAN">IBAN</option>
              <option value="CASH">Nakit</option>
            </select>
          </label>
          <label className="text-[13px]">
            Tarih başlangıç
            <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-[13px]">
            Tarih bitiş
            <input type="date" className="mt-1 w-full rounded border px-3 py-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="text-[13px]">
            Firma
            <input className="mt-1 w-full rounded border px-3 py-2" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Firma adı…" />
          </label>
          <label className="text-[13px]">
            Min tutar
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
          </label>
          <label className="text-[13px]">
            Max tutar
            <input type="number" className="mt-1 w-full rounded border px-3 py-2" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button type="button" className={appOutlineButtonClass} onClick={() => void loadEarnings()} disabled={!partnerId || loadingEarnings}>
              {loadingEarnings ? "Yükleniyor…" : "Hak edişleri getir"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-slate-100">
          <table className={appTableClass}>
            <thead>
              <tr className={appTableHeadClass}>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Tutar</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {earnings.map((e) => (
                <tr key={e.id} className={appTableRowClass}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleEarning(e.id)} />
                  </td>
                  <td className="px-3 py-3">{e.companyName ?? "—"}</td>
                  <td className="px-3 py-3">
                    {formatAdminMoney(e.amount)} {e.currency}
                  </td>
                  <td className="px-3 py-3">{e.status}</td>
                  <td className="px-3 py-3">{formatAdminDate(e.createdAt)}</td>
                </tr>
              ))}
              {!earnings.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-[13px]">
                    {partnerId ? "Uygun hak ediş yok." : "Partner seçin."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="text-[14px] font-bold text-slate-800">
          Seçili toplam: {formatAdminMoney(total)} {selectedCurrency} ({selected.size} hak ediş)
        </p>
        <p className="text-[13px] text-slate-600">
          Minimum ödeme eşiği (TRY):{" "}
          {minimumPayoutAmount > 0 ? `${formatAdminMoney(minimumPayoutAmount)} TRY` : "Uygulanmıyor (0)"}
          {selectedCurrency !== "TRY" ? " · Eşik yalnızca TRY ödemeleri için geçerlidir." : null}
        </p>
        {belowMinimumThreshold ? (
          <p className="text-[13px] font-semibold text-amber-700">
            Seçili toplam minimum eşiğin altında; ödeme oluşturulamaz.
          </p>
        ) : null}

        <label className="block text-[13px]">
          Açıklama (isteğe bağlı)
          <textarea className="mt-1 w-full rounded border px-3 py-2" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>
        <label className="block text-[13px]">
          Gerekçe (zorunlu)
          <textarea className="mt-1 w-full rounded border px-3 py-2" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          Bu payout oluşturma işlemini onaylıyorum
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className={appOutlineButtonClass} onClick={onClose} disabled={submitting}>
            Vazgeç
          </button>
          <button
            type="button"
            className={appPrimaryButtonClass}
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? "Oluşturuluyor…" : "Payout Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}
