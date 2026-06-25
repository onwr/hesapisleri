import type { CollectionAccountOption } from "@/lib/collection-account-utils";
import {
  groupCollectionAccounts,
  isCollectionBankGroupAccount,
} from "@/lib/collection-account-utils";
import type { PosPaymentMethod } from "@/lib/pos-checkout-utils";

export const POS_PAYMENT_ACCOUNT_EMPTY_MESSAGE =
  "Bu ödeme yöntemi için uygun tahsilat hesabı bulunamadı.";

export const POS_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL = "Kasa ve Banka";

export type PosCollectionAccount = CollectionAccountOption & {
  status?: string;
};

export function isPosStaticCashAccount(
  account: Pick<PosCollectionAccount, "type" | "bankName" | "iban">
) {
  return account.type === "STATIC" && !isCollectionBankGroupAccount(account);
}

export function isPosStaticBankAccount(
  account: Pick<PosCollectionAccount, "type" | "bankName" | "iban">
) {
  return account.type === "STATIC" && isCollectionBankGroupAccount(account);
}

export function isPosEligibleAccountForMethod(
  account: Pick<
    PosCollectionAccount,
    "type" | "bankName" | "iban" | "status"
  >,
  paymentMethod: PosPaymentMethod
) {
  if (account.status && account.status !== "ACTIVE") {
    return false;
  }

  if (paymentMethod === "CASH") {
    return (
      account.type === "CASH" || isPosStaticCashAccount(account)
    );
  }

  if (paymentMethod === "BANK_TRANSFER") {
    return account.type === "BANK" || isPosStaticBankAccount(account);
  }

  return account.type === "BANK" || account.type === "POS";
}

export function filterPosAccountsForMethod(
  accounts: PosCollectionAccount[],
  paymentMethod: PosPaymentMethod
) {
  return accounts.filter((account) =>
    isPosEligibleAccountForMethod(account, paymentMethod)
  );
}

export function groupPosAccountsForMethod(
  accounts: PosCollectionAccount[],
  paymentMethod: PosPaymentMethod
) {
  const eligible = filterPosAccountsForMethod(accounts, paymentMethod);

  if (paymentMethod === "CARD") {
    const posAccounts = eligible.filter((account) => account.type === "POS");
    const bankAccounts = eligible.filter((account) => account.type === "BANK");
    return {
      cashAccounts: posAccounts,
      bankAccounts,
    };
  }

  return groupCollectionAccounts(eligible);
}

export function validatePosPaymentAccount(
  account: {
    id: string;
    companyId: string;
    type: string;
    status: string;
    name: string;
    currency?: string;
    bankName?: string | null;
    iban?: string | null;
  } | null,
  companyId: string,
  paymentMethod: PosPaymentMethod
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

  if (
    !isPosEligibleAccountForMethod(
      {
        type: account.type,
        status: account.status,
        bankName: account.bankName,
        iban: account.iban,
      },
      paymentMethod
    )
  ) {
    return {
      ok: false,
      message:
        "Seçilen hesap bu ödeme yöntemi için uygun değil.",
    };
  }

  return { ok: true, account };
}
