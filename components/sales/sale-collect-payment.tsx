"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { resolveDefaultCollectionAccountId } from "@/lib/collection-account-utils";
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
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const { accounts, loading: accountsLoading } = useCollectionAccounts();
  const [amount, setAmount] = useState(remainingAmount.toFixed(2));
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(remainingAmount.toFixed(2));
  }, [remainingAmount]);

  useEffect(() => {
    if (accountsLoading) return;

    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : resolveDefaultCollectionAccountId(accounts)
    );
  }, [accounts, accountsLoading]);

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

    if (parsedAmount > remainingAmount) {
      setError(`En fazla ${formatMoney(remainingAmount)} tahsil edebilirsiniz.`);
      return;
    }

    const result = await mutate(`/api/sales/${saleId}/collect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: parsedAmount,
        accountId,
      }),
    });

    if (result.ok) {
      setMessage(result.message ?? "Tahsilat kaydedildi.");
    } else if (result.error !== "duplicate_submit") {
      setError(result.error);
    }
  }

  const canSubmit =
    !isSubmitting &&
    !accountsLoading &&
    accounts.length > 0 &&
    Boolean(accountId);

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

      <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
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
            Tahsilat hesabı
          </label>
          <CollectionAccountSelect
            accounts={accounts}
            loading={accountsLoading}
            value={accountId}
            onChange={setAccountId}
            disabled={isSubmitting || accountsLoading}
            required
            className="h-11 w-full rounded-xl border border-orange-200 bg-white px-4 text-[13px] font-bold text-[#0f1f4d] outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleCollect}
            disabled={!canSubmit}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 text-[12px] font-black text-white disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSubmitting ? "Kaydediliyor..." : "Tahsil Et"}
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
