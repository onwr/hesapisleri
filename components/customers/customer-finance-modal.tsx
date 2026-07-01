"use client";

import { useEffect, useMemo, useState } from "react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { FinanceAccountSelect } from "@/components/cash-bank/finance-account-select";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useFinanceAccounts } from "@/hooks/use-finance-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { resolveDefaultCollectionAccountId } from "@/lib/collection-account-utils";
import { formatCustomerMoney } from "@/lib/customers-page-utils";
import { roundMoney } from "@/lib/sale-payment-utils";

type FinanceModalMode = "collection" | "payment" | null;

type Props = {
  customerId: string;
  customerName: string;
  currentBalance: number;
  mode: FinanceModalMode;
  onClose: () => void;
  onSuccess?: (customerBalance?: number | null) => void;
};

export function CustomerFinanceModal({
  customerId,
  customerName,
  currentBalance,
  mode,
  onClose,
  onSuccess,
}: Props) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const {
    accounts: collectionAccounts,
    loading: collectionLoading,
  } = useCollectionAccounts();
  const { accounts: financeAccounts, loading: financeLoading } =
    useFinanceAccounts();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const accounts = mode === "payment" ? financeAccounts : collectionAccounts;
  const accountsLoading = mode === "payment" ? financeLoading : collectionLoading;

  useEffect(() => {
    if (!mode) return;
    setError(null);
    setMessage(null);
    setAmount("");
    setDescription("");
    setDate(new Date().toISOString().slice(0, 10));
  }, [mode]);

  useEffect(() => {
    if (mode === "payment" || accounts.length === 0) return;
    setAccountId(resolveDefaultCollectionAccountId(accounts));
  }, [accounts, mode]);

  useEffect(() => {
    if (mode !== "payment" || financeAccounts.length === 0) return;
    const defaultAccount =
      financeAccounts.find((account) => account.isDefault) ?? financeAccounts[0];
    if (defaultAccount) {
      setAccountId(defaultAccount.id);
    }
  }, [financeAccounts, mode]);

  const parsedAmount = Number(amount);
  const projectedBalance = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return currentBalance;
    }
    if (mode === "collection") {
      return roundMoney(currentBalance - parsedAmount);
    }
    if (mode === "payment") {
      return roundMoney(currentBalance + parsedAmount);
    }
    return currentBalance;
  }, [currentBalance, mode, parsedAmount]);

  if (!mode) return null;

  const title =
    mode === "collection" ? "Tahsilat Al" : "Ödeme Yap";

  async function submit() {
    setError(null);
    setMessage(null);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }

    if (!accountId) {
      setError("Hesap seçin.");
      return;
    }

    const endpoint =
      mode === "collection"
        ? `/api/customers/${customerId}/collections`
        : `/api/customers/${customerId}/payments`;

    const result = await mutate(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        amount: parsedAmount,
        date,
        description: description.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    if (result.ok) {
      const nextBalance =
        typeof result.data === "object" &&
        result.data !== null &&
        "customerBalance" in result.data
          ? (result.data as { customerBalance?: number | null }).customerBalance
          : undefined;
      setMessage(result.message ?? "İşlem kaydedildi.");
      onSuccess?.(nextBalance);
    } else if (result.error !== "duplicate_submit") {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-bold text-[#0f1f4d]">{title}</h3>
        <p className="mt-1 text-[12px] text-slate-500">{customerName}</p>

        <p className="mt-2 text-[12px] text-slate-600">
          Güncel cari bakiye:{" "}
          <span className="font-bold text-[#0f1f4d]">
            {formatCustomerMoney(Math.abs(currentBalance))}
          </span>
        </p>

        <div className="mt-4 space-y-3 text-[12px]">
          <label className="block">
            İşlem türü
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              value={title}
              readOnly
            />
          </label>

          {mode === "payment" ? (
            <FinanceAccountSelect
              accounts={financeAccounts}
              value={accountId}
              onChange={setAccountId}
              disabled={accountsLoading || isSubmitting}
              required
              showBalance
              showSetupLink={false}
              label="Kasa / Banka Hesabı"
              emptyMessage="Ödeme yapabilmek için aktif bir kasa veya banka hesabı oluşturun."
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
            />
          ) : (
            <label className="block">
              Kasa / Banka Hesabı
              <CollectionAccountSelect
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                accounts={collectionAccounts}
                value={accountId}
                onChange={setAccountId}
                loading={collectionLoading}
                disabled={isSubmitting}
              />
            </label>
          )}

          <label className="block">
            Tutar
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            İşlem tarihi
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            Açıklama
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            İşlem sonrası bakiye (önizleme):{" "}
            <span className="font-bold text-[#0f1f4d]">
              {formatCustomerMoney(Math.abs(projectedBalance))}
            </span>
          </p>

          {error ? <p className="text-red-600">{error}</p> : null}
          {message ? <p className="text-emerald-700">{message}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-bold text-slate-600"
            onClick={onClose}
          >
            Kapat
          </button>
          <button
            type="button"
            disabled={isSubmitting || accounts.length === 0}
            className="rounded-xl bg-[#0f1f4d] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            onClick={submit}
          >
            {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
