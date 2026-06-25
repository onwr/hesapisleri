"use client";

import Link from "next/link";
import {
  COLLECTION_ACCOUNT_EMPTY_LINK_LABEL,
  COLLECTION_ACCOUNT_EMPTY_MESSAGE,
  formatCollectionAccountLabel,
  groupCollectionAccounts,
  type CollectionAccountOption,
} from "@/lib/collection-account-utils";

type CollectionAccountSelectProps = {
  accounts: CollectionAccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
};

export function CollectionAccountSelect({
  accounts,
  value,
  onChange,
  loading = false,
  disabled = false,
  required = false,
  className,
  id,
}: CollectionAccountSelectProps) {
  if (loading) {
    return (
      <select
        id={id}
        value=""
        disabled
        className={className}
        aria-busy="true"
      >
        <option value="">Hesaplar yükleniyor...</option>
      </select>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-900">
        {COLLECTION_ACCOUNT_EMPTY_MESSAGE}{" "}
        <Link href="/cash-bank" className="font-black underline">
          {COLLECTION_ACCOUNT_EMPTY_LINK_LABEL}
        </Link>{" "}
        bölümünden hesap oluşturun.
      </div>
    );
  }

  const { cashAccounts, bankAccounts } = groupCollectionAccounts(accounts);
  const resolvedValue =
    value && accounts.some((account) => account.id === value) ? value : "";

  return (
    <select
      id={id}
      value={resolvedValue}
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
              {formatCollectionAccountLabel(account)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {bankAccounts.length > 0 ? (
        <optgroup label="Bankalar">
          {bankAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {formatCollectionAccountLabel(account)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}

export function getCollectionAccountName(
  accounts: CollectionAccountOption[],
  accountId: string | null | undefined
) {
  if (!accountId) return null;
  return accounts.find((account) => account.id === accountId)?.name ?? null;
}
