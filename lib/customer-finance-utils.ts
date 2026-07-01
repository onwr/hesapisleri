import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { validateCollectionAccount } from "@/lib/collection-account-utils";
import { validateFinanceAccount } from "@/lib/finance-account-utils";

export const CUSTOMER_FINANCE_NOTE_PREFIX = "customer-finance:";

export const CUSTOMER_FINANCE_VALIDATION_MESSAGES = {
  accountRequired: "Aktif kasa veya banka hesabı bulunamadı.",
  foreignAccount: "Seçilen hesap bu şirkete ait değil.",
  passiveAccount: "Pasif hesaptan işlem yapılamaz.",
  insufficientBalance: "Hesap bakiyesi bu ödeme için yetersiz.",
  invalidAmount: "Geçerli bir tutar girin.",
  invalidAmountNumeric: "Tutar geçerli bir sayı olmalıdır.",
  invalidDate: "Geçerli bir işlem tarihi girin.",
  foreignCustomer: "Müşteri bu firmaya ait değil.",
} as const;

export function buildCustomerFinanceNote(input: {
  customerId: string;
  kind: "collection" | "payment";
  idempotencyKey?: string | null;
}) {
  const parts = [
    CUSTOMER_FINANCE_NOTE_PREFIX,
    `customerId=${input.customerId}`,
    `kind=${input.kind}`,
  ];
  if (input.idempotencyKey) {
    parts.push(`idempotency=${input.idempotencyKey}`);
  }
  return parts.join(";");
}

export function parseCustomerFinanceNote(note: string | null | undefined) {
  if (!note?.startsWith(CUSTOMER_FINANCE_NOTE_PREFIX)) return null;

  const customerMatch = note.match(/customerId=([^;]+)/);
  const kindMatch = note.match(/kind=(collection|payment)/);
  const idempotencyMatch = note.match(/idempotency=([^;]+)/);

  if (!customerMatch || !kindMatch) return null;

  return {
    customerId: customerMatch[1]!,
    kind: kindMatch[1]! as "collection" | "payment",
    idempotencyKey: idempotencyMatch?.[1] ?? null,
  };
}

export function parseCustomerFinanceAmount(value: unknown) {
  const amount = roundCashMoney(Number(value));
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return {
      ok: false as const,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.invalidAmountNumeric,
    };
  }
  if (amount <= 0) {
    return {
      ok: false as const,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.invalidAmount,
    };
  }
  return { ok: true as const, amount };
}

export function validateCustomerFinanceAccount(
  account: {
    id: string;
    companyId: string;
    type: string;
    status: string;
    currency: string;
    name: string;
    balance?: unknown;
  } | null,
  companyId: string,
  options: {
    amount?: number;
    checkBalance?: boolean;
    purpose: "collection" | "payment";
  }
):
  | { ok: true; account: NonNullable<typeof account> }
  | { ok: false; message: string } {
  if (!account) {
    return {
      ok: false,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.accountRequired,
    };
  }

  if (account.companyId !== companyId) {
    return {
      ok: false,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.foreignAccount,
    };
  }

  if (account.status !== "ACTIVE") {
    return {
      ok: false,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.passiveAccount,
    };
  }

  const validation =
    options.purpose === "collection"
      ? validateCollectionAccount(account, companyId)
      : validateFinanceAccount(account, companyId, { purpose: "disbursement" });

  if (!validation.ok) {
    if (validation.message.includes("erişim")) {
      return {
        ok: false,
        message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.foreignAccount,
      };
    }
    if (validation.message.includes("aktif değil")) {
      return {
        ok: false,
        message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.passiveAccount,
      };
    }
    if (validation.message.includes("bulunamadı")) {
      return {
        ok: false,
        message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.accountRequired,
      };
    }
    return validation;
  }

  if (
    options.checkBalance &&
    options.purpose === "payment" &&
    options.amount != null &&
    options.amount > 0
  ) {
    const balance = roundCashMoney(Number(account.balance ?? 0));
    if (balance < roundCashMoney(options.amount)) {
      return {
        ok: false,
        message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.insufficientBalance,
      };
    }
  }

  return { ok: true, account };
}

export function parseCustomerFinanceDate(value?: string | null) {
  if (!value?.trim()) {
    return { ok: true as const, date: new Date() };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      ok: false as const,
      message: CUSTOMER_FINANCE_VALIDATION_MESSAGES.invalidDate,
    };
  }

  return { ok: true as const, date: parsed };
}
