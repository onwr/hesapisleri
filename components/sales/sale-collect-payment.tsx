"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/invoice-form-utils";

type SaleCollectPaymentProps = {
  saleId: string;
  saleNo: string;
  remainingAmount: number;
};

export function SaleCollectPayment({
  saleId,
  saleNo,
  remainingAmount,
}: SaleCollectPaymentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(remainingAmount.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("CASH");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCollect() {
    setMessage(null);
    setError(null);

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tahsilat tutarı girin.");
      return;
    }

    if (parsedAmount > remainingAmount) {
      setError(`En fazla ${formatMoney(remainingAmount)} tahsil edebilirsiniz.`);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sales/${saleId}/collect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parsedAmount,
            paymentMethod,
          }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || !result.success) {
          setError(result.message ?? "Tahsilat kaydedilemedi.");
          return;
        }

        setMessage(result.message ?? "Tahsilat kaydedildi.");
        router.refresh();
      } catch {
        setError("Tahsilat sırasında bir hata oluştu.");
      }
    });
  }

  return (
    <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
          <Wallet size={20} />
        </div>

        <div>
          <p className="text-[15px] font-black text-[#0f1f4d]">
            Kalan tahsilat
          </p>
          <p className="mt-1 text-[12px] font-semibold text-orange-700">
            {saleNo} için {formatMoney(remainingAmount)} tahsil edilebilir.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
            Tahsil edilecek tutar
          </label>
          <input
            type="number"
            min="0.01"
            max={remainingAmount}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-500">
            Hesap
          </label>
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as "CASH" | "BANK")
            }
            className="h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          >
            <option value="CASH">Nakit Kasa</option>
            <option value="BANK">Banka / Havale</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCollect}
            disabled={isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-[12px] font-black text-white disabled:opacity-60"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
            {isPending ? "Kaydediliyor..." : "Tahsil Et"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[12px] font-semibold text-rose-600">{error}</p>
      ) : null}

      {message ? (
        <p className="mt-3 text-[12px] font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
