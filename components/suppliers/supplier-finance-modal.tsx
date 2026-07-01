"use client";

import { useEffect, useState } from "react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { resolveDefaultCollectionAccountId } from "@/lib/collection-account-utils";
import { formatSupplierMoney } from "@/lib/supplier-utils";

type FinanceModalMode = "payment" | "collection" | "adjustment" | null;

type Props = {
  supplierId: string;
  supplierName: string;
  currency: string;
  payableAmount: number;
  receivableAmount: number;
  canPay: boolean;
  canCollect: boolean;
  canAdjust: boolean;
  mode: FinanceModalMode;
  onClose: () => void;
};

export function SupplierFinanceModal({
  supplierId,
  supplierName,
  currency,
  payableAmount,
  receivableAmount,
  canPay,
  canCollect,
  canAdjust,
  mode,
  onClose,
}: Props) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const { accounts, loading } = useCollectionAccounts();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAccountId(resolveDefaultCollectionAccountId(accounts));
  }, [accounts]);

  useEffect(() => {
    if (!mode) return;
    setError(null);
    setWarning(null);
    setMessage(null);
    if (mode === "payment") setAmount(payableAmount > 0 ? payableAmount.toFixed(2) : "");
    if (mode === "collection") setAmount(receivableAmount > 0 ? receivableAmount.toFixed(2) : "");
    if (mode === "adjustment") setAmount("");
  }, [mode, payableAmount, receivableAmount]);

  if (!mode) return null;

  const title =
    mode === "payment"
      ? "Tedarikçiye Ödeme Yap"
      : mode === "collection"
        ? "Tedarikçiden Tahsilat Al"
        : "Cari Düzeltme Hareketi";

  async function submit() {
    setError(null);
    setWarning(null);
    setMessage(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tutar girin.");
      return;
    }

    if (mode === "adjustment") {
      if (!description.trim() || !reason.trim()) {
        setError("Açıklama ve neden zorunludur.");
        return;
      }

      const result = await mutate(`/api/suppliers/${supplierId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          direction,
          description,
          reason,
        }),
      });

      if (result.ok) {
        setMessage(result.message ?? "Kaydedildi.");
      } else if (result.error !== "duplicate_submit") {
        setError(result.error);
      }
      return;
    }

    if (!accountId) {
      setError("Hesap seçin.");
      return;
    }

    const endpoint =
      mode === "payment"
        ? `/api/suppliers/${supplierId}/payments`
        : `/api/suppliers/${supplierId}/collections`;

    const result = await mutate(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        amount: parsedAmount,
        description: description.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    if (result.ok) {
      setMessage(result.message ?? "İşlem kaydedildi.");
    } else if (result.error !== "duplicate_submit") {
      setError(result.error);
    }
  }

  const disabled =
    (mode === "payment" && !canPay) ||
    (mode === "collection" && !canCollect) ||
    (mode === "adjustment" && !canAdjust);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[15px] font-bold text-[#0f1f4d]">{title}</h3>
        <p className="mt-1 text-[12px] text-slate-500">{supplierName}</p>

        {mode === "payment" ? (
          <p className="mt-2 text-[12px] text-slate-600">
            Tedarikçiye Borcumuz:{" "}
            <span className="font-bold text-rose-600">
              {formatSupplierMoney(payableAmount, currency)}
            </span>
          </p>
        ) : null}

        {mode === "collection" ? (
          <p className="mt-2 text-[12px] text-slate-600">
            Tedarikçiden Alacağımız:{" "}
            <span className="font-bold text-emerald-600">
              {formatSupplierMoney(receivableAmount, currency)}
            </span>
          </p>
        ) : null}

        <div className="mt-4 space-y-3 text-[12px]">
          {mode !== "adjustment" ? (
            <label className="block">
              Kasa / Banka Hesabı
              <CollectionAccountSelect
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                accounts={accounts}
                value={accountId}
                onChange={setAccountId}
                loading={loading}
                disabled={disabled || isSubmitting}
              />
            </label>
          ) : (
            <label className="block">
              Yön
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "PAYABLE" | "RECEIVABLE")}
              >
                <option value="PAYABLE">Tedarikçiye borcumuz artar</option>
                <option value="RECEIVABLE">Tedarikçiden alacağımız artar</option>
              </select>
            </label>
          )}

          <label className="block">
            Tutar
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </label>

          <label className="block">
            Açıklama
            <textarea
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </label>

          {mode === "adjustment" ? (
            <label className="block">
              Neden
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={disabled || isSubmitting}
              />
            </label>
          ) : null}

          {error ? <p className="text-red-600">{error}</p> : null}
          {warning ? <p className="text-amber-700">{warning}</p> : null}
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
            disabled={disabled || isSubmitting}
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
