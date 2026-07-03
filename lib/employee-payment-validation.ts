import type { EmployeePaymentType } from "@prisma/client";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  employeePaymentAllowsPendingWithoutAccount,
  employeePaymentDisbursesCash,
} from "@/lib/employee-payment-type-mapping";
import { validateFinanceAccount } from "@/lib/finance-account-utils";

export const EMPLOYEE_PAYMENT_VALIDATION_MESSAGES = {
  accountRequired:
    "Ödeme yapılacak kasa veya banka hesabını seçin.",
  foreignAccount: "Seçilen hesap bu firmaya ait değil.",
  passiveAccount: "Pasif hesaptan ödeme yapılamaz.",
  insufficientBalance: "Seçilen hesapta yeterli bakiye bulunmuyor.",
  invalidAmount: "Geçerli bir tutar girin.",
  invalidAmountNumeric: "Tutar geçerli bir sayı olmalıdır.",
} as const;

export function parseEmployeePaymentAmount(value: unknown) {
  const amount = roundCashMoney(Number(value));
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return { ok: false as const, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.invalidAmountNumeric };
  }
  if (amount <= 0) {
    return { ok: false as const, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.invalidAmount };
  }
  return { ok: true as const, amount };
}

export function validateEmployeePaymentAccount(
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
    paymentCurrency?: string;
    amount?: number;
    checkBalance?: boolean;
    allowNegativeCashBalance?: boolean;
  } = {}
):
  | { ok: true; account: NonNullable<typeof account> }
  | { ok: false; message: string } {
  if (!account) {
    return {
      ok: false,
      message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired,
    };
  }

  if (account.companyId !== companyId) {
    return { ok: false, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.foreignAccount };
  }

  if (account.status !== "ACTIVE") {
    return { ok: false, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.passiveAccount };
  }

  const validation = validateFinanceAccount(account, companyId, {
    purpose: "disbursement",
    paymentCurrency: options.paymentCurrency ?? "TRY",
  });

  if (!validation.ok) {
    if (validation.message.includes("aktif değil")) {
      return { ok: false, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.passiveAccount };
    }
    if (validation.message.includes("erişim")) {
      return { ok: false, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.foreignAccount };
    }
    return { ok: false, message: validation.message };
  }

  if (
    options.checkBalance &&
    !options.allowNegativeCashBalance &&
    options.amount != null &&
    account.balance != null
  ) {
    const balance = roundCashMoney(Number(account.balance));
    if (balance < roundCashMoney(options.amount)) {
      return {
        ok: false,
        message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.insufficientBalance,
      };
    }
  }

  return { ok: true, account: validation.account };
}

export function validateEmployeePaymentCreateInput(input: {
  type: EmployeePaymentType;
  amount: unknown;
  relatedAccountId?: string | null;
  currency?: string;
}) {
  const amountResult = parseEmployeePaymentAmount(input.amount);
  if (!amountResult.ok) {
    return amountResult;
  }

  const accountId = input.relatedAccountId?.trim() || "";
  const disburses = employeePaymentDisbursesCash(input.type);
  const allowsPending = employeePaymentAllowsPendingWithoutAccount(input.type);

  if (disburses && !allowsPending && !accountId) {
    return { ok: false as const, message: EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired };
  }

  return {
    ok: true as const,
    amount: amountResult.amount,
    accountId: accountId || null,
    payImmediately: Boolean(accountId),
  };
}
