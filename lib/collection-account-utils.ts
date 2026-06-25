import type { SerializedAccountOption } from "@/lib/account-utils";
import {
  formatFinanceAccountLabel,
  type FinanceAccountOption,
} from "@/lib/finance-account-utils";

export const COLLECTION_ACCOUNT_TYPES = ["CASH", "BANK", "STATIC"] as const;

export type CollectionAccountType = (typeof COLLECTION_ACCOUNT_TYPES)[number];

export type CollectionAccountOption = SerializedAccountOption & {
  bankName?: string | null;
  iban?: string | null;
};

export const COLLECTION_ACCOUNT_EMPTY_MESSAGE =
  "Aktif kasa veya banka hesabı bulunamadı.";

export const COLLECTION_ACCOUNT_EMPTY_LINK_LABEL = "Kasa ve Banka";

export function isCollectionEligibleAccountType(type: string) {
  return COLLECTION_ACCOUNT_TYPES.includes(type as CollectionAccountType);
}

export function isCollectionEligibleAccount(account: {
  type: string;
  status?: string;
}) {
  return (
    account.status === "ACTIVE" && isCollectionEligibleAccountType(account.type)
  );
}

export const formatCollectionAccountLabel = formatFinanceAccountLabel;

export function isCollectionBankGroupAccount(account: Pick<CollectionAccountOption, "type" | "bankName" | "iban">) {
  if (account.type === "BANK") return true;
  if (account.type === "STATIC") {
    return Boolean(account.bankName?.trim() || account.iban?.trim());
  }
  return false;
}

export function groupCollectionAccounts(accounts: CollectionAccountOption[]) {
  const cashAccounts = accounts.filter(
    (account) => account.type === "CASH" || !isCollectionBankGroupAccount(account)
  );
  const bankAccounts = accounts.filter((account) =>
    isCollectionBankGroupAccount(account)
  );

  return { cashAccounts, bankAccounts };
}

export function resolveDefaultCollectionAccountId(
  accounts: CollectionAccountOption[],
  preferredId?: string | null
) {
  if (preferredId && accounts.some((account) => account.id === preferredId)) {
    return preferredId;
  }

  return (
    accounts.find((account) => account.isDefault)?.id ??
    accounts[0]?.id ??
    ""
  );
}

export function validateCollectionAccount(
  account: {
    id: string;
    companyId: string;
    type: string;
    status: string;
    name: string;
    currency?: string;
  } | null,
  companyId: string
):
  | { ok: true; account: NonNullable<typeof account> }
  | { ok: false; message: string } {
  if (!account) {
    return {
      ok: false,
      message: "Seçilen tahsilat hesabı bulunamadı.",
    };
  }

  if (account.companyId !== companyId) {
    return {
      ok: false,
      message: "Bu hesaba erişim yetkiniz yok.",
    };
  }

  if (account.status !== "ACTIVE") {
    return {
      ok: false,
      message: "Seçilen hesap aktif değil.",
    };
  }

  if (!isCollectionEligibleAccountType(account.type)) {
    return {
      ok: false,
      message:
        "Tahsilat yalnızca kasa veya banka hesaplarına kaydedilebilir.",
    };
  }

  return { ok: true, account };
}

export type { FinanceAccountOption };
