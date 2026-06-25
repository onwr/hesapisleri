"use client";

import Link from "next/link";
import {
  formatFinanceAccountLabel,
  groupFinanceAccounts,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";

type FinanceAccountSelectProps = {
  accounts: FinanceAccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  label?: string;
  emptyMessage?: string;
  emptyHref?: string;
  emptyLinkLabel?: string;
};

export function FinanceAccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  id,
  label = "Ödeme Hesabı",
  emptyMessage = "Ödeme yapabilmek için önce aktif bir kasa veya banka hesabı oluşturun.",
  emptyHref = "/cash-bank",
  emptyLinkLabel = "Kasa ve Banka",
}: FinanceAccountSelectProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-900">
        {emptyMessage}{" "}
        <Link href={emptyHref} className="font-black underline">
          {emptyLinkLabel}
        </Link>
        .
      </div>
    );
  }

  const { cashAccounts, bankAccounts } = groupFinanceAccounts(accounts);

  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        className={className}
      >
        <option value="">Hesap seçin</option>
        {cashAccounts.length > 0 ? (
          <optgroup label="Kasalar">
            {cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatFinanceAccountLabel(account)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {bankAccounts.length > 0 ? (
          <optgroup label="Bankalar">
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatFinanceAccountLabel(account)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

export function getFinanceAccountName(
  accounts: FinanceAccountOption[],
  accountId: string | null | undefined
) {
  if (!accountId) return null;
  return accounts.find((account) => account.id === accountId)?.name ?? null;
}
