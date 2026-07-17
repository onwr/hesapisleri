import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  getTransactionDirection,
  getTransactionSignedAmount,
  type AccountTransactionLike,
} from "@/lib/cash-bank-account-utils";
import {
  startOfNextZonedDay,
  startOfZonedDay,
} from "@/lib/finance/financial-period";

export type CashClosingDifferenceKind = "balanced" | "surplus" | "shortage";

export function resolveClosingPeriod(closingDateInput: Date | string) {
  const base =
    typeof closingDateInput === "string"
      ? new Date(`${closingDateInput}T12:00:00`)
      : closingDateInput;

  if (Number.isNaN(base.getTime())) {
    throw new Error("Geçerli bir kapanış tarihi seçiniz.");
  }

  const periodStart = startOfZonedDay(base);
  const periodEnd = startOfNextZonedDay(base);

  return {
    closingDate: periodStart,
    periodStart,
    periodEnd,
  };
}

export function calculateClosingDifference(
  expectedCashAmount: number,
  countedCashAmount: number
) {
  return roundCashMoney(
    roundCashMoney(countedCashAmount) - roundCashMoney(expectedCashAmount)
  );
}

export function getClosingDifferenceKind(
  differenceAmount: number
): CashClosingDifferenceKind {
  const value = roundCashMoney(differenceAmount);
  if (value === 0) return "balanced";
  if (value > 0) return "surplus";
  return "shortage";
}

export function getClosingDifferenceLabel(differenceAmount: number) {
  const kind = getClosingDifferenceKind(differenceAmount);
  if (kind === "balanced") return "Kasa dengede";
  if (kind === "surplus") return "Kasa fazlası";
  return "Kasa açığı";
}

export function validateCountedCashAmount(value: unknown) {
  const amount =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));

  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false as const,
      message: "Sayılan kasa tutarı geçerli değil.",
    };
  }

  return {
    ok: true as const,
    amount: roundCashMoney(amount),
  };
}

/** Teorik kasa bakiyesi (periodEnd anı): currentBalance − sonraki dönem hareketleri. */
export function computeExpectedCashAtPeriodEnd(input: {
  currentBalance: number;
  transactions: Array<Pick<AccountTransactionLike, "type" | "title" | "amount" | "date">>;
  periodEnd: Date;
}) {
  const afterPeriod = input.transactions
    .filter((tx) => tx.date.getTime() >= input.periodEnd.getTime())
    .reduce((sum, tx) => sum + getTransactionSignedAmount(tx), 0);

  return roundCashMoney(roundCashMoney(input.currentBalance) - afterPeriod);
}

export function summarizeAccountTransactionsForPeriod(input: {
  transactions: Array<
    Pick<AccountTransactionLike, "type" | "title" | "amount" | "date" | "note">
  >;
  periodStart: Date;
  periodEnd: Date;
}) {
  let totalCollections = 0;
  let totalExpenses = 0;
  let totalRefunds = 0;
  let totalTransfersIn = 0;
  let totalTransfersOut = 0;
  let periodNet = 0;

  for (const tx of input.transactions) {
    const t = tx.date.getTime();
    if (t < input.periodStart.getTime() || t >= input.periodEnd.getTime()) {
      continue;
    }

    const signed = getTransactionSignedAmount(tx);
    periodNet = roundCashMoney(periodNet + signed);

    const title = tx.title.toLocaleLowerCase("tr-TR");
    const direction = getTransactionDirection(tx);

    if (
      tx.type === "COLLECTION" ||
      title.includes("cari tahsilat")
    ) {
      if (direction === "in") {
        totalCollections = roundCashMoney(totalCollections + Number(tx.amount));
      }
    }

    if (tx.type === "EXPENSE" || (tx.type === "PAYMENT" && !title.includes("transfer"))) {
      if (direction === "out") {
        totalExpenses = roundCashMoney(totalExpenses + Number(tx.amount));
      }
    }

    if (title.includes("iptal") || title.includes("iade") || title.includes("reversal")) {
      totalRefunds = roundCashMoney(totalRefunds + Math.abs(signed));
    }

    if (tx.type === "TRANSFER" || title.includes("transfer")) {
      if (direction === "in") {
        totalTransfersIn = roundCashMoney(totalTransfersIn + Number(tx.amount));
      } else {
        totalTransfersOut = roundCashMoney(totalTransfersOut + Number(tx.amount));
      }
    }
  }

  return {
    totalCollections,
    totalExpenses,
    totalRefunds,
    totalTransfersIn,
    totalTransfersOut,
    periodNet,
  };
}

export function toClosingDateKey(date: Date) {
  return startOfZonedDay(date).toISOString();
}
