"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/invoice-form-utils";

type OpenSale = {
  id: string;
  saleNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
};

type CustomerCollectPanelProps = {
  openSales: OpenSale[];
};

export function CustomerCollectPanel({ openSales }: CustomerCollectPanelProps) {
  if (openSales.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-[13px] font-black text-[#0f1f4d]">
          Açık tahsilat kaydı yok
        </p>
        <p className="mt-1 text-[12px] font-medium text-slate-500">
          Bu müşterinin tahsil edilecek satış borcu bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {openSales.map((sale) => (
        <CustomerSaleCollectCard key={sale.id} sale={sale} />
      ))}
    </div>
  );
}

function CustomerSaleCollectCard({ sale }: { sale: OpenSale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(sale.remainingAmount.toFixed(2));
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

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sales/${sale.id}/collect`, {
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
    <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/sales/${sale.id}`}
            className="text-[13px] font-black text-[#0f1f4d] hover:text-blue-600"
          >
            {sale.saleNo}
          </Link>
          <p className="mt-1 text-[11px] font-semibold text-orange-700">
            Toplam {formatMoney(sale.total)} · Kalan{" "}
            {formatMoney(sale.remainingAmount)}
          </p>
        </div>

        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-orange-700">
          {sale.paymentStatus === "PARTIAL" ? "Kısmi" : "Ödenmedi"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">
            Tahsil tutarı
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">
            Hesap
          </label>
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as "CASH" | "BANK")
            }
            className="h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-[12px] font-black text-white disabled:opacity-60"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            Tahsil Et
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-[11px] font-semibold text-rose-600">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
