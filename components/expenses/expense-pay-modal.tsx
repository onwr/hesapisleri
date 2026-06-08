"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet, X } from "lucide-react";
import { formatExpenseMoney } from "@/lib/expenses-page-utils";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

type ExpensePayModalProps = {
  open: boolean;
  onClose: () => void;
  expenseId: string;
  expenseTitle: string;
  amount: number;
  accounts: AccountOption[];
};

export function ExpensePayModal({
  open,
  onClose,
  expenseId,
  expenseTitle,
  amount,
  accounts,
}: ExpensePayModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAccountId(accounts[0]?.id ?? "");
      setPaidAt(new Date().toISOString().split("T")[0]);
      setNote("");
      setError("");
    }
  }, [open, accounts]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId]
  );

  const projectedBalance = useMemo(() => {
    if (!selectedAccount) {
      return null;
    }

    return Math.round((selectedAccount.balance - amount) * 100) / 100;
  }, [amount, selectedAccount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!accountId) {
      setError("Ödeme hesabı seçin.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${expenseId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          paidAt,
          note: note.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "Gider ödenemedi.");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Sunucuya bağlanırken bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        className="absolute inset-0"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-black text-[#0f1f4d]">Gideri Öde</h2>
            <p className="mt-1 text-[12px] font-medium text-slate-500">{expenseTitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Ödenecek Tutar
            </p>
            <p className="mt-1 text-[20px] font-black text-rose-600">
              {formatExpenseMoney(amount)}
            </p>
          </div>

          <Field label="Ödeme Hesabı" required>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
              className={inputClass}
            >
              <option value="">Hesap seçin</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({formatExpenseMoney(account.balance)})
                </option>
              ))}
            </select>
          </Field>

          {projectedBalance !== null ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
              İşlem sonrası bakiye:{" "}
              <span
                className={
                  projectedBalance < 0
                    ? "font-black text-amber-700"
                    : "font-black text-[#0f1f4d]"
                }
              >
                {formatExpenseMoney(projectedBalance)}
              </span>
            </div>
          ) : null}

          <Field label="Ödeme Tarihi" required>
            <input
              value={paidAt}
              onChange={(event) => setPaidAt(event.target.value)}
              type="date"
              required
              className={inputClass}
            />
          </Field>

          <Field label="Not">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50"
              placeholder="Ödeme notu (opsiyonel)"
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
              disabled={saving || accounts.length === 0}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 text-[13px] font-black text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Wallet size={16} />
              )}
              {saving ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
  "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] font-medium text-[#24345f] outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50";
