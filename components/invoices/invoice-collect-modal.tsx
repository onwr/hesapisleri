"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { CollectionAccountSelect } from "@/components/cash-bank/collection-account-select";
import { useCollectionAccounts } from "@/hooks/use-collection-accounts";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";
import { resolveDefaultCollectionAccountId } from "@/lib/collection-account-utils";
import { formatInvoiceMoney } from "@/lib/invoices-page-utils";
import { previewInvoicePaymentStatus } from "@/lib/invoice-payment-utils";

type InvoiceCollectModalProps = {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
};

export function InvoiceCollectModal({
  open,
  onClose,
  invoiceId,
  invoiceNo,
  total,
  paidAmount,
  remainingAmount,
}: InvoiceCollectModalProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const { accounts, loading: accountsLoading } = useCollectionAccounts();
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(remainingAmount.toFixed(2));
  const [collectedAt, setCollectedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;

    setAmount(remainingAmount.toFixed(2));
    setCollectedAt(new Date().toISOString().split("T")[0]);
    setNote("");
    setError("");
  }, [open, remainingAmount]);

  useEffect(() => {
    if (!open || accountsLoading) return;

    setAccountId((current) =>
      current && accounts.some((account) => account.id === current)
        ? current
        : resolveDefaultCollectionAccountId(accounts)
    );
  }, [open, accounts, accountsLoading]);

  const parsedAmount = Number(amount);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId]
  );

  const projectedBalance = useMemo(() => {
    if (!selectedAccount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return null;
    }

    return Math.round((selectedAccount.balance + parsedAmount) * 100) / 100;
  }, [parsedAmount, selectedAccount]);

  const statusPreview = useMemo(() => {
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return null;
    }

    return previewInvoicePaymentStatus(total, paidAmount, parsedAmount);
  }, [parsedAmount, paidAmount, total]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!accountId) {
      setError("Ödeme hesabı seçin.");
      return;
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir tahsilat tutarı girin.");
      return;
    }

    if (parsedAmount > remainingAmount) {
      setError(`En fazla ${formatInvoiceMoney(remainingAmount)} tahsil edebilirsiniz.`);
      return;
    }

    const result = await mutate(`/api/invoices/${invoiceId}/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        amount: parsedAmount,
        collectedAt,
        note: note.trim() || undefined,
      }),
    });

    if (!result.ok) {
      setError(result.error ?? "Tahsilat kaydedilemedi.");
      return;
    }

    onClose();
  }

  if (!open) {
    return null;
  }

  const canSubmit =
    !isSubmitting &&
    !accountsLoading &&
    accounts.length > 0 &&
    Boolean(accountId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        className="absolute inset-0"
        onClick={isSubmitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">Tahsilat Al</h2>
            <p className="mt-1 text-[12px] font-medium text-slate-500">{invoiceNo}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Kalan Tutar" value={formatInvoiceMoney(remainingAmount)} />
            <Metric label="Toplam" value={formatInvoiceMoney(total)} />
          </div>

          <Field label="Tahsilat Tutarı" required>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="0.01"
              max={remainingAmount}
              step="0.01"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Tahsilat Hesabı" required>
            <CollectionAccountSelect
              accounts={accounts}
              loading={accountsLoading}
              value={accountId}
              onChange={setAccountId}
              required
              disabled={isSubmitting || accountsLoading}
              className={inputClass}
            />
          </Field>

          {projectedBalance !== null ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
              İşlem sonrası hesap bakiyesi:{" "}
              <span className="font-black text-[#0f1f4d]">
                {formatInvoiceMoney(projectedBalance)}
              </span>
            </div>
          ) : null}

          {statusPreview ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-medium text-blue-800">
              Tahsilat sonrası durum:{" "}
              <span className="font-black">
                {statusPreview.paymentStatus === "PAID"
                  ? "Ödendi"
                  : statusPreview.paymentStatus === "PARTIAL"
                    ? "Kısmi Ödendi"
                    : "Ödenmedi"}
              </span>
            </div>
          ) : null}

          <Field label="Tahsilat Tarihi" required>
            <input
              value={collectedAt}
              onChange={(event) => setCollectedAt(event.target.value)}
              type="date"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Not">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50"
              placeholder="Tahsilat notu (opsiyonel)"
            />
          </Field>

          {error ? (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-violet-600 text-[13px] font-black text-white disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Wallet size={16} />
              )}
              {isSubmitting ? "Kaydediliyor..." : "Tahsilatı Kaydet"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-black text-[#24345f]">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50";
