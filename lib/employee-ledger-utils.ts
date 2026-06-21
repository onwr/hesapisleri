import type {
  EmployeePaymentDirection,
  EmployeePaymentStatus,
  EmployeePaymentType,
} from "@prisma/client";
import { getPaymentTypeLabel } from "@/lib/employee-utils";

export type EmployeeLedgerSource = {
  id: string;
  type: EmployeePaymentType;
  direction: EmployeePaymentDirection;
  amount: number | { toString(): string };
  status: EmployeePaymentStatus;
  description: string | null;
  dueDate: Date | string | null;
  paidAt: Date | string | null;
  createdAt: Date | string;
  relatedAccountId?: string | null;
  relatedTransactionId?: string | null;
  createdByUserId?: string | null;
};

export type EmployeeLedgerEntryType =
  | "SALARY_ACCRUAL"
  | "SALARY_PAYMENT"
  | "ADVANCE"
  | "DEDUCTION"
  | "BONUS"
  | "ADJUSTMENT"
  | "OTHER";

export type EmployeeLedgerRow = {
  id: string;
  paymentId: string;
  date: string;
  type: EmployeeLedgerEntryType;
  typeLabel: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  accountId: string | null;
  relatedTransactionId: string | null;
};

const LEDGER_TYPE_LABELS: Record<EmployeeLedgerEntryType, string> = {
  SALARY_ACCRUAL: "Maaş Tahakkuku",
  SALARY_PAYMENT: "Maaş Ödemesi",
  ADVANCE: "Avans",
  DEDUCTION: "Kesinti",
  BONUS: "Prim / Ek Ödeme",
  ADJUSTMENT: "Düzeltme",
  OTHER: "Diğer",
};

export function getLedgerTypeLabel(type: EmployeeLedgerEntryType) {
  return LEDGER_TYPE_LABELS[type];
}

function toAmount(value: number | { toString(): string }) {
  return Number(value);
}

function resolveLedgerDate(payment: EmployeeLedgerSource) {
  const raw = payment.paidAt ?? payment.dueDate ?? payment.createdAt;
  return new Date(raw).toISOString();
}

export function resolveLedgerEntryType(
  payment: Pick<EmployeeLedgerSource, "type" | "status" | "direction">
): EmployeeLedgerEntryType {
  if (payment.type === "DEDUCTION" || payment.direction === "DEDUCTED") {
    return "DEDUCTION";
  }

  if (payment.type === "ADVANCE") {
    return payment.status === "PAID" || payment.direction === "PAID"
      ? "ADVANCE"
      : "ADVANCE";
  }

  if (payment.type === "BONUS") {
    return payment.status === "PAID" || payment.direction === "PAID"
      ? "BONUS"
      : "BONUS";
  }

  if (payment.type === "SALARY") {
    return payment.status === "PAID" || payment.direction === "PAID"
      ? "SALARY_PAYMENT"
      : "SALARY_ACCRUAL";
  }

  if (payment.type === "OTHER") {
    return "ADJUSTMENT";
  }

  return "OTHER";
}

export function resolveLedgerDebitCredit(
  payment: Pick<
    EmployeeLedgerSource,
    "type" | "status" | "direction" | "amount"
  >
) {
  const amount = toAmount(payment.amount);

  if (payment.status === "CANCELLED") {
    return { debit: 0, credit: 0 };
  }

  if (payment.type === "DEDUCTION" || payment.direction === "DEDUCTED") {
    return { debit: 0, credit: amount };
  }

  if (payment.status === "PAID" || payment.direction === "PAID") {
    return { debit: 0, credit: amount };
  }

  return { debit: amount, credit: 0 };
}

export function calculateEmployeeCurrentBalance(
  payments: Array<
    Pick<EmployeeLedgerSource, "amount" | "status" | "direction" | "type">
  >
) {
  let balance = 0;

  for (const payment of payments) {
    if (payment.status === "CANCELLED") continue;
    const { debit, credit } = resolveLedgerDebitCredit(payment);
    balance += debit - credit;
  }

  return balance;
}

export function buildEmployeeLedgerRows(
  payments: EmployeeLedgerSource[]
): EmployeeLedgerRow[] {
  const sorted = [...payments].sort((a, b) => {
    const aTime = new Date(a.paidAt ?? a.dueDate ?? a.createdAt).getTime();
    const bTime = new Date(b.paidAt ?? b.dueDate ?? b.createdAt).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });

  let balance = 0;

  return sorted
    .filter((payment) => payment.status !== "CANCELLED")
    .map((payment) => {
      const type = resolveLedgerEntryType(payment);
      const { debit, credit } = resolveLedgerDebitCredit(payment);
      balance += debit - credit;

      return {
        id: `ledger-${payment.id}`,
        paymentId: payment.id,
        date: resolveLedgerDate(payment),
        type,
        typeLabel: getLedgerTypeLabel(type),
        description:
          payment.description?.trim() ||
          getPaymentTypeLabel(payment.type as EmployeePaymentType),
        debit,
        credit,
        balance,
        accountId: payment.relatedAccountId ?? null,
        relatedTransactionId: payment.relatedTransactionId ?? null,
      };
    })
    .reverse();
}

export function formatEmployeeLedgerBalanceLabel(balance: number) {
  if (Math.abs(balance) < 0.0001) {
    return "Dengede";
  }

  if (balance > 0) {
    return `${balance.toLocaleString("tr-TR")} ₺ Borç`;
  }

  return `${Math.abs(balance).toLocaleString("tr-TR")} ₺ Alacak`;
}

export function getEmployeeLedgerBalanceTone(balance: number) {
  if (Math.abs(balance) < 0.0001) return "neutral" as const;
  if (balance > 0) return "debt" as const;
  return "credit" as const;
}
