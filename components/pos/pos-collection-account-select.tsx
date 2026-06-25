"use client";

import Link from "next/link";
import {
  formatFinanceAccountLabel,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";
import {
  filterPosAccountsForMethod,
  groupPosAccountsForMethod,
  POS_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL,
  POS_PAYMENT_ACCOUNT_EMPTY_MESSAGE,
  type PosCollectionAccount,
} from "@/lib/pos-payment-account-utils";
import type { PosPaymentMethod } from "@/lib/pos-checkout-utils";

type PosCollectionAccountSelectProps = {
  accounts: PosCollectionAccount[];
  paymentMethod: PosPaymentMethod;
  value: string;
  onChange: (accountId: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function PosCollectionAccountSelect({
  accounts,
  paymentMethod,
  value,
  onChange,
  disabled = false,
  className,
  id,
}: PosCollectionAccountSelectProps) {
  const eligible = filterPosAccountsForMethod(accounts, paymentMethod);

  if (eligible.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-900">
        {POS_PAYMENT_ACCOUNT_EMPTY_MESSAGE}{" "}
        <Link href="/cash-bank" className="font-black underline">
          {POS_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL}
        </Link>
        .
      </div>
    );
  }

  const grouped = groupPosAccountsForMethod(accounts, paymentMethod);
  const primaryLabel =
    paymentMethod === "CARD" ? "POS / Terminal" : "Kasalar";
  const secondaryLabel = "Bankalar";

  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-500">Tahsilat Hesabı</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        className={className}
      >
        <option value="">Hesap seçin</option>
        {grouped.cashAccounts.length > 0 ? (
          <optgroup label={primaryLabel}>
            {grouped.cashAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatFinanceAccountLabel(account as FinanceAccountOption)}
              </option>
            ))}
          </optgroup>
        ) : null}
        {grouped.bankAccounts.length > 0 ? (
          <optgroup label={secondaryLabel}>
            {grouped.bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {formatFinanceAccountLabel(account as FinanceAccountOption)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

export function getPosCollectionAccountName(
  accounts: PosCollectionAccount[],
  accountId: string | null | undefined
) {
  if (!accountId) return null;
  return accounts.find((account) => account.id === accountId)?.name ?? null;
}
