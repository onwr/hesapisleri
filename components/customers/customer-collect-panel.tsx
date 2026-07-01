"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import {
  resolveDefaultCollectionAccountId,
  type CollectionAccountOption,
} from "@/lib/collection-account-utils";
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
  accounts: CollectionAccountOption[];
};

export function CustomerCollectPanel({
  openSales,
  accounts,
}: CustomerCollectPanelProps) {
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
        <CustomerSaleCollectCard key={sale.id} sale={sale} accounts={accounts} />
      ))}
    </div>
  );
}

function CustomerSaleCollectCard({
  sale,
  accounts,
}: {
  sale: OpenSale;
  accounts: CollectionAccountOption[];
}) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [amount, setAmount] = useState(sale.remainingAmount.toFixed(2));
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAccountId(resolveDefaultCollectionAccountId(accounts));
  }, [accounts]);

  async function handleCollect() {
    setMessage(null);
    setError(null);

    const parsedAmount = Number(amount);

    if (!accountId) {
      setError("Tahsilat hesabı seçin.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tahsilat tutarı girin.");
      return;
    }

    const result = await mutate(`/api/sales/${sale.id}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsedAmount, accountId }),
    });

    if (result.ok) {
      setMessage(result.message ?? "Tahsilat kaydedildi.");
    } else if (result.error !== "duplicate_submit") {
      setError(result.error);
    }
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

      <div className="grid gap-3 md:grid-cols-[1fr_200px_auto]">
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
            Tahsilat hesabı
          </label>
          <CollectionAccountSelect
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            disabled={isSubmitting}
            className="h-10 w-full rounded-xl border border-orange-200 bg-white px-3 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCollect}
            disabled={isSubmitting || accounts.length === 0}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-[12px] font-black text-white disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
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
