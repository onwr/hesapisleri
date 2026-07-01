import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export type SupplierBalanceDirection = "PAYABLE" | "RECEIVABLE" | "SETTLED";

export type SupplierOpeningBalanceDirection = "PAYABLE" | "RECEIVABLE" | "SETTLED";

export const SUPPLIER_BALANCE_LABELS = {
  PAYABLE: "Tedarikçiye Borcumuz",
  RECEIVABLE: "Tedarikçiden Alacağımız",
  SETTLED: "Hesap Kapalı",
} as const;

export const SUPPLIER_OPENING_DIRECTION_LABELS = {
  PAYABLE: "Tedarikçiye borcumuz var",
  RECEIVABLE: "Tedarikçiden alacağımız var",
  SETTLED: "Bakiye yok",
} as const;

/** Signed convention: positive = payable (we owe supplier), negative = receivable. */
export function resolveSupplierBalanceDirection(
  signedBalance: number
): SupplierBalanceDirection {
  const rounded = roundCashMoney(signedBalance);
  if (rounded > 0) return "PAYABLE";
  if (rounded < 0) return "RECEIVABLE";
  return "SETTLED";
}

export function resolveSupplierBalanceView(signedBalance: number) {
  const rounded = roundCashMoney(signedBalance);
  const direction = resolveSupplierBalanceDirection(rounded);

  return {
    signedBalance: rounded,
    direction,
    payableAmount: rounded > 0 ? rounded : 0,
    receivableAmount: rounded < 0 ? Math.abs(rounded) : 0,
    directionLabel: SUPPLIER_BALANCE_LABELS[direction],
    netStatusLabel:
      direction === "PAYABLE"
        ? `${SUPPLIER_BALANCE_LABELS.PAYABLE}`
        : direction === "RECEIVABLE"
          ? `${SUPPLIER_BALANCE_LABELS.RECEIVABLE}`
          : SUPPLIER_BALANCE_LABELS.SETTLED,
  };
}

export function signedBalanceFromOpeningInput(input: {
  amount: number;
  direction: SupplierOpeningBalanceDirection;
}) {
  const amount = roundCashMoney(input.amount);
  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount < 0) {
    return { ok: false as const, message: "Açılış tutarı geçerli ve negatif olmayan bir sayı olmalıdır." };
  }

  if (input.direction === "SETTLED" || amount === 0) {
    return { ok: true as const, signed: 0 };
  }

  if (input.direction === "PAYABLE") {
    return { ok: true as const, signed: amount };
  }

  return { ok: true as const, signed: -amount };
}

export function parseSupplierOpeningDirection(value: unknown): SupplierOpeningBalanceDirection {
  if (value === "PAYABLE" || value === "RECEIVABLE" || value === "SETTLED") {
    return value;
  }
  return "SETTLED";
}

export function paymentBalanceEffect(amount: number) {
  return roundCashMoney(-amount);
}

export function collectionBalanceEffect(amount: number) {
  return roundCashMoney(amount);
}

export function adjustmentBalanceEffect(
  amount: number,
  direction: "PAYABLE" | "RECEIVABLE"
) {
  const rounded = roundCashMoney(amount);
  return direction === "PAYABLE" ? rounded : -rounded;
}

export function summarizeSupplierBalances(signedBalances: number[]) {
  let totalPayable = 0;
  let totalReceivable = 0;

  for (const signed of signedBalances) {
    const view = resolveSupplierBalanceView(signed);
    totalPayable = roundCashMoney(totalPayable + view.payableAmount);
    totalReceivable = roundCashMoney(totalReceivable + view.receivableAmount);
  }

  return { totalPayable, totalReceivable };
}
