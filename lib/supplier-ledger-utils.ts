import type { SupplierLedgerEntryType } from "@prisma/client";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  resolveSupplierBalanceDirection,
  resolveSupplierBalanceView,
  type SupplierBalanceDirection,
} from "@/lib/supplier-balance-utils";

export type SupplierLedgerRowType =
  | "OPENING_BALANCE"
  | "EXPENSE"
  | "PAYMENT"
  | "COLLECTION"
  | "ADJUSTMENT"
  | "RETURN";

export type SupplierLedgerRow = {
  id: string;
  date: string;
  type: SupplierLedgerRowType;
  typeLabel: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  balanceDirection: SupplierBalanceDirection;
  relatedEntityId: string | null;
  relatedEntityHref: string | null;
  accountId: string | null;
  accountName: string | null;
  accountTransactionId: string | null;
  createdByUserId: string | null;
};

const LEDGER_TYPE_LABELS: Record<SupplierLedgerRowType, string> = {
  OPENING_BALANCE: "Açılış Bakiyesi",
  EXPENSE: "Gider / Alış",
  PAYMENT: "Ödeme",
  COLLECTION: "Tahsilat",
  ADJUSTMENT: "Cari Düzeltme",
  RETURN: "İade",
};

export function getSupplierLedgerTypeLabel(type: SupplierLedgerRowType) {
  return LEDGER_TYPE_LABELS[type];
}

export function mapPrismaLedgerType(type: SupplierLedgerEntryType): SupplierLedgerRowType {
  if (type === "OPENING_BALANCE") return "OPENING_BALANCE";
  if (type === "PAYMENT") return "PAYMENT";
  if (type === "COLLECTION") return "COLLECTION";
  return "ADJUSTMENT";
}

export function expenseLedgerDebitCredit(input: {
  amount: number;
  paymentStatus: string;
  status: string;
}) {
  if (input.status === "CANCELLED") {
    return { debit: 0, credit: 0 };
  }

  if (input.paymentStatus === "PAID") {
    return { debit: 0, credit: 0 };
  }

  return { debit: roundCashMoney(input.amount), credit: 0 };
}

export function expensePaymentLedgerDebitCredit(amount: number) {
  return { debit: 0, credit: roundCashMoney(amount) };
}

export function ledgerEntryDebitCredit(balanceEffect: number, amount: number) {
  const effect = roundCashMoney(balanceEffect);
  const absAmount = roundCashMoney(Math.abs(amount));
  if (effect > 0) {
    return { debit: absAmount, credit: 0 };
  }
  if (effect < 0) {
    return { debit: 0, credit: absAmount };
  }
  return { debit: 0, credit: 0 };
}

export function buildSupplierLedgerRunningBalance(
  rows: Array<Omit<SupplierLedgerRow, "balance" | "balanceDirection">>
): SupplierLedgerRow[] {
  let running = 0;

  return rows.map((row) => {
    running = roundCashMoney(running + row.debit - row.credit);
    const direction = resolveSupplierBalanceDirection(running);
    return {
      ...row,
      balance: running,
      balanceDirection: direction,
    };
  });
}

export function buildSupplierAccountSummary(signedBalance: number) {
  const view = resolveSupplierBalanceView(signedBalance);
  return {
    signedBalance: view.signedBalance,
    payableAmount: view.payableAmount,
    receivableAmount: view.receivableAmount,
    direction: view.direction,
    directionLabel: view.directionLabel,
    netStatusLabel: view.netStatusLabel,
  };
}
