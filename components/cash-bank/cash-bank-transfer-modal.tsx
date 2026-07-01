"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Repeat, X } from "lucide-react";
import { useTenantMutation } from "@/hooks/use-tenant-mutation";

export type CashBankAccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type CashBankTransferModalProps = {
  open: boolean;
  onClose: () => void;
  accounts: CashBankAccountOption[];
  defaultFromAccountId?: string;
};

export function CashBankTransferModal({
  open,
  onClose,
  accounts,
  defaultFromAccountId,
}: CashBankTransferModalProps) {
  const { mutate, isSubmitting } = useTenantMutation({ refresh: false });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [fromAccountId, setFromAccountId] = useState(defaultFromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setFromAccountId(defaultFromAccountId ?? accounts[0]?.id ?? "");
      setToAccountId("");
      setAmount("");
      setNote("");
      setError("");
      setWarning("");
    }
  }, [open, defaultFromAccountId, accounts]);

  const fromAccount = useMemo(
    () => accounts.find((account) => account.id === fromAccountId),
    [accounts, fromAccountId]
  );

  const projectedFromBalance = useMemo(() => {
    const parsedAmount = Number(amount);
    if (!fromAccount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return null;
    }

    return Math.round((fromAccount.balance - parsedAmount) * 100) / 100;
  }, [amount, fromAccount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setWarning("");

    const parsedAmount = Number(amount);
    if (!fromAccountId || !toAccountId) {
      setError("Kaynak ve hedef hesap seçin.");
      return;
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Geçerli bir transfer tutarı girin.");
      return;
    }

    const result = await mutate("/api/cash-bank/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAccountId,
        toAccountId,
        amount: parsedAmount,
        note: note.trim() || undefined,
      }),
    });

    if (!result.ok) {
      if (result.error !== "duplicate_submit") {
        setError(result.error);
      }
      return;
    }

    const payload = result.data as { negativeBalanceWarning?: boolean } | undefined;
    if (payload?.negativeBalanceWarning) {
      setWarning("Kaynak hesap bakiyesi eksiye düştü.");
    }

    onClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Repeat size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-[#0f1f4d]">
                Hesaplar Arası Transfer
              </h3>
              <p className="text-[11px] font-medium text-slate-500">
                Kaynak hesaptan çıkış, hedef hesaba giriş yazılır.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 p-5">
          <Field label="Kaynak Hesap" required>
            <select
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
            >
              <option value="">Seçin</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.balance.toFixed(2)} TRY)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Hedef Hesap" required>
            <select
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
            >
              <option value="">Seçin</option>
              {accounts
                .filter((account) => account.id !== fromAccountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.balance.toFixed(2)} TRY)
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Tutar" required>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
              placeholder="0.00"
            />
          </Field>

          <Field label="Not">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
              placeholder="Opsiyonel açıklama"
            />
          </Field>

          {projectedFromBalance !== null && projectedFromBalance < 0 ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
              Uyarı: Transfer sonrası kaynak hesap bakiyesi{" "}
              {projectedFromBalance.toFixed(2)} TRY olacak (eksiye düşer).
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
              {error}
            </div>
          ) : null}

          {warning ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
              {warning}
            </div>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-600 text-[13px] font-black text-white disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
              {isSubmitting ? "Transfer ediliyor..." : "Transfer Et"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 px-4 text-[13px] font-black text-slate-600 hover:bg-slate-50"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </div>
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
