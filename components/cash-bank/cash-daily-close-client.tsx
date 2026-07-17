"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Loader2,
  Lock,
  Scale,
} from "lucide-react";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { formatMoney } from "@/lib/format-utils";
import {
  getClosingDifferenceKind,
  getClosingDifferenceLabel,
  calculateClosingDifference,
} from "@/lib/cash-daily-closing-utils";

type CashAccountOption = {
  id: string;
  name: string;
};

type PreviewData = {
  account: { id: string; name: string; balance: number };
  closingDate: string;
  periodStart: string;
  periodEnd: string;
  expectedCashAmount: number;
  periodNet: number;
  totalCashSales: number;
  totalCardSales: number;
  totalCreditSales: number;
  totalCollections: number;
  totalExpenses: number;
  totalRefunds: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
  existingClosing: {
    id: string;
    status: string;
    countedCashAmount: number;
    differenceAmount: number;
    closedAt: string;
  } | null;
};

type ClosingListItem = {
  id: string;
  closingDate: string;
  account: { id: string; name: string };
  expectedCashAmount: number;
  countedCashAmount: number;
  differenceAmount: number;
  status: string;
  closedAt: string;
  closedByUser: { id: string; name: string };
  note: string | null;
  periodStart: string;
  periodEnd: string;
  totalCashSales: number;
  totalCardSales: number;
  totalCreditSales: number;
  totalCollections: number;
  totalExpenses: number;
  totalRefunds: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
};

type CashDailyCloseClientProps = {
  accounts: CashAccountOption[];
  canManage: boolean;
  defaultAccountId: string;
  todayValue: string;
};

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
}

function formatDateTimeLabel(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
  });
}

export function CashDailyCloseClient({
  accounts,
  canManage,
  defaultAccountId,
  todayValue,
}: CashDailyCloseClientProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [closingDate, setClosingDate] = useState(todayValue);
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [history, setHistory] = useState<ClosingListItem[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ClosingListItem | null>(
    null
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/cash-bank/daily-close");
    const json = await res.json();
    if (res.ok && json.success) {
      setHistory(json.data);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    if (!accountId || !closingDate) return;
    setLoadingPreview(true);
    setError("");
    try {
      const params = new URLSearchParams({
        mode: "preview",
        accountId,
        closingDate,
      });
      const res = await fetch(`/api/cash-bank/daily-close?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPreview(null);
        setError(json.message || "Önizleme alınamadı.");
        return;
      }
      setPreview(json.data);
      if (!countedCash && !json.data.existingClosing) {
        setCountedCash(String(json.data.expectedCashAmount));
      }
    } catch {
      setError("Önizleme alınamadı.");
    } finally {
      setLoadingPreview(false);
    }
  }, [accountId, closingDate, countedCash]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadPreview();
  }, [accountId, closingDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const countedValue = Number(String(countedCash).replace(",", ".")) || 0;
  const expected = preview?.expectedCashAmount ?? 0;
  const difference = calculateClosingDifference(expected, countedValue);
  const differenceKind = getClosingDifferenceKind(difference);
  const differenceLabel = getClosingDifferenceLabel(difference);
  const alreadyClosed = Boolean(preview?.existingClosing);

  const summaryCards = useMemo(() => {
    if (!preview) return [];
    return [
      { label: "Nakit satış", value: preview.totalCashSales },
      { label: "Kart satış", value: preview.totalCardSales },
      { label: "Veresiye satış", value: preview.totalCreditSales },
      { label: "Cari tahsilat", value: preview.totalCollections },
      { label: "Nakit gider", value: preview.totalExpenses },
      { label: "İptal / iade etkisi", value: preview.totalRefunds },
      { label: "Beklenen kasa", value: preview.expectedCashAmount },
      { label: "Sayılan kasa", value: countedValue },
      { label: "Fark", value: difference },
    ];
  }, [preview, countedValue, difference]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!canManage) {
      setError("Bu işlem için yetkiniz yok.");
      return;
    }

    if (alreadyClosed) {
      setError("Bu gün için kasa kapanışı zaten yapılmış.");
      return;
    }

    const result = await mutate("/api/cash-bank/daily-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        closingDate,
        countedCashAmount: countedValue,
        note,
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setError(result.error || "Kapanış kaydedilemedi.");
      }
      return;
    }

    setSuccess(result.message || "Gün sonu kasa kapanışı kaydedildi.");
    setNote("");
    await loadPreview();
    await loadHistory();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/cash-bank"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-[#0f1f4d]"
          >
            <ArrowLeft size={14} />
            Kasa & Banka
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#0f1f4d]">
            Gün Sonu Kasa Kapanışı
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistemdeki beklenen nakdi fiili sayımla karşılaştırıp günü kapatın.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#24345f]">
              Tarih
            </label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-[#24345f]">
              Kasa hesabı
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              {accounts.length === 0 ? (
                <option value="">Nakit kasa hesabı yok</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {loadingPreview ? (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Loader2 className="animate-spin" size={16} />
            Hesaplanıyor...
          </div>
        ) : null}

        {preview ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-black text-[#0f1f4d]">
                  {formatMoney(card.value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#24345f]">
              Fiili / sayılan nakit
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              disabled={!canManage || alreadyClosed}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
              placeholder="0,00"
            />
          </div>
          <div
            className={[
              "inline-flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-black",
              differenceKind === "balanced"
                ? "bg-emerald-50 text-emerald-700"
                : differenceKind === "surplus"
                  ? "bg-sky-50 text-sky-700"
                  : "bg-rose-50 text-rose-700",
            ].join(" ")}
          >
            <Scale size={16} />
            {differenceLabel}: {formatMoney(difference)}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-bold text-[#24345f]">
            Not (opsiyonel)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canManage || alreadyClosed}
            className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-[#0f1f4d] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50"
            placeholder="Örn. akşam sayımı, bozuk para ayrımı..."
          />
        </div>

        {alreadyClosed ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Bu gün için kasa kapanışı zaten yapılmış.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 size={16} />
            {success}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="submit"
              disabled={
                isSubmitting ||
                loadingPreview ||
                alreadyClosed ||
                !accountId ||
                accounts.length === 0
              }
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#0f1f4d] px-5 text-sm font-black text-white disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Lock size={16} />
              )}
              Gün Sonunu Kapat
            </button>
          ) : (
            <p className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500">
              <Lock size={14} />
              Kapanış oluşturma yetkiniz yok
            </p>
          )}
          <button
            type="button"
            onClick={() => void loadPreview()}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-[#0f1f4d]"
          >
            <Calculator size={16} />
            Yeniden Hesapla
          </button>
        </div>
      </form>

      <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-extrabold text-[#0f1f4d]">
          Geçmiş kapanışlar
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Kasa</th>
                <th className="px-3 py-2">Beklenen</th>
                <th className="px-3 py-2">Sayılan</th>
                <th className="px-3 py-2">Fark</th>
                <th className="px-3 py-2">Kapatan</th>
                <th className="px-3 py-2">Zaman</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Detay</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm font-semibold text-slate-400"
                  >
                    Henüz kapanış kaydı yok.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-[#0f1f4d]">
                      {formatDateLabel(row.closingDate)}
                    </td>
                    <td className="px-3 py-3">{row.account.name}</td>
                    <td className="px-3 py-3">
                      {formatMoney(row.expectedCashAmount)}
                    </td>
                    <td className="px-3 py-3">
                      {formatMoney(row.countedCashAmount)}
                    </td>
                    <td className="px-3 py-3 font-bold">
                      {formatMoney(row.differenceAmount)}
                    </td>
                    <td className="px-3 py-3">{row.closedByUser.name}</td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDateTimeLabel(row.closedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDetail(row)}
                        className="text-[12px] font-bold text-blue-700 hover:underline"
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedDetail ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Kapanış detayı
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-[#0f1f4d]">
                  {formatDateLabel(selectedDetail.closingDate)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600"
              >
                Kapat
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <span className="font-bold text-slate-500">Kasa:</span>{" "}
                {selectedDetail.account.name}
              </p>
              <p>
                <span className="font-bold text-slate-500">Dönem:</span>{" "}
                {formatDateTimeLabel(selectedDetail.periodStart)} –{" "}
                {formatDateTimeLabel(selectedDetail.periodEnd)}
              </p>
              <p>
                <span className="font-bold text-slate-500">Kapatan:</span>{" "}
                {selectedDetail.closedByUser.name}
              </p>
              <p>
                <span className="font-bold text-slate-500">Kapanış zamanı:</span>{" "}
                {formatDateTimeLabel(selectedDetail.closedAt)}
              </p>
              {selectedDetail.note ? (
                <p>
                  <span className="font-bold text-slate-500">Not:</span>{" "}
                  {selectedDetail.note}
                </p>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Beklenen", selectedDetail.expectedCashAmount],
                ["Sayılan", selectedDetail.countedCashAmount],
                ["Fark", selectedDetail.differenceAmount],
                ["Nakit satış", selectedDetail.totalCashSales],
                ["Kart satış", selectedDetail.totalCardSales],
                ["Veresiye", selectedDetail.totalCreditSales],
                ["Tahsilat", selectedDetail.totalCollections],
                ["Gider", selectedDetail.totalExpenses],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {label}
                  </p>
                  <p className="font-black text-[#0f1f4d]">
                    {formatMoney(Number(value))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
