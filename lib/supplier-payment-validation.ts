import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { validateFinanceAccount } from "@/lib/finance-account-utils";
import {
  resolveSupplierBalanceView,
  type SupplierBalanceDirection,
} from "@/lib/supplier-balance-utils";

export const SUPPLIER_PAYMENT_VALIDATION_MESSAGES = {
  accountRequired: "Ödeme yapılacak kasa veya banka hesabını seçin.",
  collectionAccountRequired: "Tahsilat yapılacak kasa veya banka hesabını seçin.",
  foreignAccount: "Seçilen hesap bu firmaya ait değil.",
  passiveAccount: "Pasif hesaptan işlem yapılamaz.",
  insufficientBalance: "Seçilen hesapta yeterli bakiye bulunmuyor.",
  invalidAmount: "Geçerli bir tutar girin.",
  invalidAmountNumeric: "Tutar geçerli bir sayı olmalıdır.",
  noReceivable: "Tedarikçiden alacak bulunmuyor; tahsilat yapılamaz.",
  collectionExceedsReceivable: "Tahsilat tutarı tedarikçiden alacağımızı aşamaz.",
  foreignSupplier: "Tedarikçi bu firmaya ait değil.",
} as const;

export function parseSupplierFinanceAmount(value: unknown) {
  const amount = roundCashMoney(Number(value));
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return {
      ok: false as const,
      message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.invalidAmountNumeric,
    };
  }
  if (amount <= 0) {
    return { ok: false as const, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.invalidAmount };
  }
  return { ok: true as const, amount };
}

export function validateSupplierFinanceAccount(
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
    purpose?: "disbursement" | "collection";
  } = {}
):
  | { ok: true; account: NonNullable<typeof account> }
  | { ok: false; message: string } {
  if (!account) {
    return {
      ok: false,
      message:
        options.purpose === "collection"
          ? SUPPLIER_PAYMENT_VALIDATION_MESSAGES.collectionAccountRequired
          : SUPPLIER_PAYMENT_VALIDATION_MESSAGES.accountRequired,
    };
  }

  if (account.companyId !== companyId) {
    return { ok: false, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.foreignAccount };
  }

  if (account.status !== "ACTIVE") {
    return { ok: false, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.passiveAccount };
  }

  const validation = validateFinanceAccount(account, companyId, {
    purpose: options.purpose ?? "disbursement",
    paymentCurrency: options.paymentCurrency ?? "TRY",
  });

  if (!validation.ok) {
    if (validation.message.includes("aktif değil")) {
      return { ok: false, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.passiveAccount };
    }
    if (validation.message.includes("erişim")) {
      return { ok: false, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.foreignAccount };
    }
    return { ok: false, message: validation.message };
  }

  if (
    options.checkBalance &&
    options.purpose !== "collection" &&
    options.amount != null &&
    options.amount > 0
  ) {
    const balance = roundCashMoney(Number(account.balance ?? 0));
    if (balance < roundCashMoney(options.amount)) {
      return {
        ok: false,
        message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.insufficientBalance,
      };
    }
  }

  return { ok: true, account };
}

export function validateSupplierCollectionAmount(
  amount: number,
  currentSignedBalance: number
) {
  const view = resolveSupplierBalanceView(currentSignedBalance);
  if (view.direction !== "RECEIVABLE" || view.receivableAmount <= 0) {
    return { ok: false as const, message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.noReceivable };
  }

  if (roundCashMoney(amount) > view.receivableAmount) {
    return {
      ok: false as const,
      message: SUPPLIER_PAYMENT_VALIDATION_MESSAGES.collectionExceedsReceivable,
    };
  }

  return { ok: true as const };
}

export function describeOverpaymentNotice(
  paymentAmount: number,
  payableBefore: number
): string | null {
  const over = roundCashMoney(paymentAmount - payableBefore);
  if (payableBefore <= 0 || over <= 0) return null;
  return `Ödeme tutarı borcu ${over.toFixed(2)} ${""} aşıyor; tedarikçiden alacak oluşacak.`.replace(
    "  ",
    ""
  );
}

export function formatSupplierBalanceDirectionLabel(direction: SupplierBalanceDirection) {
  if (direction === "PAYABLE") return "Tedarikçiye Borcumuz";
  if (direction === "RECEIVABLE") return "Tedarikçiden Alacağımız";
  return "Hesap Kapalı";
}
