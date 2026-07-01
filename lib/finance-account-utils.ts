import type { SerializedAccountOption } from "@/lib/account-utils";

export const FINANCE_OUTFLOW_ACCOUNT_TYPES = ["CASH", "BANK"] as const;

export type FinanceOutflowAccountType =
  (typeof FINANCE_OUTFLOW_ACCOUNT_TYPES)[number];

export type FinanceAccountOption = SerializedAccountOption;

export function isFinanceOutflowAccountType(type: string) {
  return FINANCE_OUTFLOW_ACCOUNT_TYPES.includes(type as FinanceOutflowAccountType);
}

export function isFinanceOutflowEligibleAccount(account: {
  type: string;
  status?: string;
}) {
  return account.status === "ACTIVE" && isFinanceOutflowAccountType(account.type);
}

export function formatFinanceAccountLabel(
  account: Pick<FinanceAccountOption, "name" | "currency">
) {
  return `${account.name} — ${account.currency}`;
}

export function formatFinanceAccountDisbursementLabel(
  account: Pick<FinanceAccountOption, "name" | "type" | "currency" | "balance">
) {
  const typeLabel = getFinanceAccountTypeLabel(account.type);
  const balance = Number(account.balance).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${account.name} (${typeLabel}) — ${balance} ${account.currency}`;
}

export function groupFinanceAccounts(accounts: FinanceAccountOption[]) {
  const cashAccounts = accounts.filter((account) => account.type === "CASH");
  const bankAccounts = accounts.filter((account) => account.type === "BANK");

  return { cashAccounts, bankAccounts };
}

export function getFinanceAccountTypeLabel(type: string) {
  if (type === "CASH") return "Kasa";
  if (type === "BANK") return "Banka";
  return type;
}

export type FinanceAccountValidationPurpose = "collection" | "disbursement";

export function validateFinanceAccount(
  account: {
    id: string;
    companyId: string;
    type: string;
    status: string;
    currency: string;
    name: string;
  } | null,
  companyId: string,
  options?: {
    paymentCurrency?: string;
    purpose?: FinanceAccountValidationPurpose;
  }
):
  | { ok: true; account: NonNullable<typeof account> }
  | { ok: false; message: string } {
  const purpose = options?.purpose ?? "disbursement";

  if (!account) {
    return {
      ok: false,
      message:
        purpose === "collection"
          ? "Seçilen tahsilat hesabı bulunamadı."
          : "Seçilen ödeme hesabı bulunamadı.",
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

  if (!isFinanceOutflowAccountType(account.type)) {
    return {
      ok: false,
      message:
        purpose === "collection"
          ? "Tahsilat yalnızca kasa veya banka hesaplarına kaydedilebilir."
          : "Ödeme yalnızca kasa veya banka hesaplarından yapılabilir.",
    };
  }

  const paymentCurrency = (options?.paymentCurrency ?? "TRY").trim().toUpperCase();
  const accountCurrency = account.currency.trim().toUpperCase();

  if (paymentCurrency !== accountCurrency) {
    return {
      ok: false,
      message: `Ödeme para birimi (${paymentCurrency}) ile hesap para birimi (${accountCurrency}) uyuşmuyor.`,
    };
  }

  return { ok: true, account };
}

export const EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_MESSAGE =
  "Ödeme yapabilmek için aktif bir kasa veya banka hesabı oluşturun.";

export const EMPLOYEE_PAYMENT_ACCOUNT_EMPTY_LINK_LABEL = "Kasa ve Banka";
