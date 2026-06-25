import {
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import { getFinanceMirrorKind } from "@/lib/finance-reversal-utils";
import {
  getTransactionDirection,
  inferTransactionSource,
  roundCashMoney,
  type AccountTransactionLike,
} from "@/lib/cash-bank-account-utils";

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export type ExpenseForAggregation = {
  amount: unknown;
  date: Date;
  paymentStatus?: string | null;
  status?: string | null;
};

export type FinanceAggregationBreakdown = {
  saleCollectionIncome: number;
  manualIncome: number;
  recordedExpenseTotal: number;
  paidExpenseTotal: number;
  manualCashExpense: number;
  /** @deprecated use financeMirrorOutTotal */
  saleCancelExpense: number;
  reversalOutTotal: number;
  correctionOutTotal: number;
  financeMirrorOutTotal: number;
  transferInTotal: number;
  transferOutTotal: number;
  totalIncome: number;
  /** Operasyonel gider; ters kayıt/düzeltme hariç */
  totalExpense: number;
  totalAccruedExpense: number;
  netCashFlow: number;
};

export type MonthlyCashFlowPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
  saleCollectionIncome: number;
  manualIncome: number;
};

export function isTransferTransaction(
  transaction: Pick<AccountTransactionLike, "type" | "title">
) {
  if (transaction.type === "TRANSFER") {
    return true;
  }

  const title = transaction.title.toLocaleLowerCase("tr-TR");
  return title.includes("transfer");
}

export function isActiveExpenseRecord(expense: ExpenseForAggregation) {
  return expense.status !== "CANCELLED";
}

export function sumExpensesInRange(
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date,
  predicate: (expense: ExpenseForAggregation) => boolean
) {
  return roundCashMoney(
    expenses
      .filter(
        (expense) =>
          isActiveExpenseRecord(expense) &&
          predicate(expense) &&
          expense.date.getTime() >= startOfDay(from).getTime() &&
          expense.date.getTime() <= endOfDay(to).getTime()
      )
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
  );
}

export function sumRecordedUnpaidExpenses(
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date
) {
  return sumExpensesInRange(
    expenses,
    from,
    to,
    (expense) => expense.paymentStatus !== "PAID"
  );
}

export function sumPaidExpenseCashOut(
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date
) {
  return sumExpensesInRange(
    expenses,
    from,
    to,
    (expense) => expense.paymentStatus === "PAID"
  );
}

export function sumAccruedExpenses(
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date
) {
  return sumExpensesInRange(expenses, from, to, () => true);
}

export function shouldExcludeFromIncomeExpenseTotals(
  transaction: Pick<AccountTransactionLike, "type" | "title" | "expenseId">
) {
  if (transaction.expenseId) {
    return true;
  }

  return isTransferTransaction(transaction);
}

export function aggregateAccountTransactions(
  transactions: AccountTransactionLike[],
  from?: Date,
  to?: Date
): Omit<
  FinanceAggregationBreakdown,
  "recordedExpenseTotal" | "paidExpenseTotal" | "totalAccruedExpense"
> {
  let saleCollectionIncome = 0;
  let manualIncome = 0;
  let manualCashExpense = 0;
  let reversalOutTotal = 0;
  let correctionOutTotal = 0;
  let transferInTotal = 0;
  let transferOutTotal = 0;

  for (const transaction of transactions) {
    if (from && to) {
      const value = transaction.date.getTime();
      if (
        value < startOfDay(from).getTime() ||
        value > endOfDay(to).getTime()
      ) {
        continue;
      }
    }

    const amount = roundCashMoney(Number(transaction.amount));

    if (transaction.expenseId) {
      continue;
    }

    if (isTransferTransaction(transaction)) {
      const direction = getTransactionDirection(transaction);
      if (direction === "in") {
        transferInTotal += amount;
      } else {
        transferOutTotal += amount;
      }
      continue;
    }

    const source = inferTransactionSource(transaction);
    const direction = getTransactionDirection(transaction);
    const mirrorKind = getFinanceMirrorKind(transaction);

    if (direction === "in") {
      if (source.key === "collection" || source.key === "sale") {
        saleCollectionIncome += amount;
      } else {
        manualIncome += amount;
      }
      continue;
    }

    if (mirrorKind === "REVERSAL") {
      reversalOutTotal += amount;
      continue;
    }

    if (mirrorKind === "CORRECTION") {
      correctionOutTotal += amount;
      continue;
    }

    if (source.key === "cancel") {
      reversalOutTotal += amount;
      continue;
    }

    manualCashExpense += amount;
  }

  saleCollectionIncome = roundCashMoney(saleCollectionIncome);
  manualIncome = roundCashMoney(manualIncome);
  manualCashExpense = roundCashMoney(manualCashExpense);
  reversalOutTotal = roundCashMoney(reversalOutTotal);
  correctionOutTotal = roundCashMoney(correctionOutTotal);
  const financeMirrorOutTotal = roundCashMoney(
    reversalOutTotal + correctionOutTotal
  );
  transferInTotal = roundCashMoney(transferInTotal);
  transferOutTotal = roundCashMoney(transferOutTotal);

  const totalIncome = roundCashMoney(saleCollectionIncome + manualIncome);
  const totalExpense = roundCashMoney(manualCashExpense);

  return {
    saleCollectionIncome,
    manualIncome,
    manualCashExpense,
    saleCancelExpense: financeMirrorOutTotal,
    reversalOutTotal,
    correctionOutTotal,
    financeMirrorOutTotal,
    transferInTotal,
    transferOutTotal,
    totalIncome,
    totalExpense,
    netCashFlow: roundCashMoney(
      totalIncome - totalExpense - financeMirrorOutTotal
    ),
  };
}

export function combineFinanceBreakdown(
  accountTransactions: AccountTransactionLike[],
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date
): FinanceAggregationBreakdown {
  const accountPart = aggregateAccountTransactions(
    accountTransactions,
    from,
    to
  );
  const recordedExpenseTotal = sumRecordedUnpaidExpenses(expenses, from, to);
  const paidExpenseTotal = sumPaidExpenseCashOut(expenses, from, to);
  const totalAccruedExpense = sumAccruedExpenses(expenses, from, to);
  const totalExpense = roundCashMoney(
    paidExpenseTotal + accountPart.manualCashExpense
  );
  const financeMirrorOutTotal = accountPart.financeMirrorOutTotal;

  return {
    ...accountPart,
    recordedExpenseTotal,
    paidExpenseTotal,
    totalAccruedExpense,
    totalExpense,
    netCashFlow: roundCashMoney(
      accountPart.totalIncome - totalExpense - financeMirrorOutTotal
    ),
  };
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getShortMonth(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
  }).format(date);
}

export function buildMonthlyCashFlowData(
  transactions: AccountTransactionLike[],
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date,
  maxMonths = 6
): MonthlyCashFlowPoint[] {
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> =
    [];

  let cursor = startOfMonth(to);
  const rangeStart = startOfMonth(from);

  while (cursor >= rangeStart && buckets.length < maxMonths) {
    buckets.unshift({
      key: getMonthKey(cursor),
      label: getShortMonth(cursor),
      start: startOfMonth(cursor),
      end: endOfMonth(cursor),
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  return buckets.map((bucket) => {
    const bucketFrom =
      bucket.start.getTime() < startOfDay(from).getTime() ? from : bucket.start;
    const bucketTo =
      bucket.end.getTime() > endOfDay(to).getTime() ? to : bucket.end;

    const breakdown = combineFinanceBreakdown(
      transactions,
      expenses,
      bucketFrom,
      bucketTo
    );

    return {
      month: bucket.label,
      income: breakdown.totalIncome,
      expense: breakdown.totalExpense,
      net: breakdown.netCashFlow,
      saleCollectionIncome: breakdown.saleCollectionIncome,
      manualIncome: breakdown.manualIncome,
    };
  });
}

export function sumActiveAccountBalances(
  accounts: Array<{ balance: unknown; status?: string | null }>
) {
  return roundCashMoney(
    accounts
      .filter((account) => account.status === "ACTIVE" || !account.status)
      .reduce((sum, account) => sum + Number(account.balance), 0)
  );
}

export function mapAccountTransactions(
  rows: Array<{
    id: string;
    date: Date;
    createdAt: Date;
    title: string;
    note: string | null;
    amount: unknown;
    type: string;
    expenseId?: string | null;
  }>
): AccountTransactionLike[] {
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    createdAt: row.createdAt,
    title: row.title,
    note: row.note,
    amount: Number(row.amount),
    type: row.type,
    expenseId: row.expenseId ?? null,
  }));
}
