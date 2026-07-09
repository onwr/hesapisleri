import { getFinanceMirrorKind } from "@/lib/finance-reversal-utils";
import {
  getTransactionDirection,
  inferTransactionSource,
  roundCashMoney,
  type AccountTransactionLike,
} from "@/lib/cash-bank-account-utils";
import {
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  iterateZonedMonthBuckets,
  toExclusiveBound,
} from "@/lib/finance/financial-period";

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

/**
 * Sum expenses in half-open range [from, toExclusive).
 */
export function sumExpensesInRange(
  expenses: ExpenseForAggregation[],
  from: Date,
  toExclusive: Date,
  predicate: (expense: ExpenseForAggregation) => boolean
) {
  return roundCashMoney(
    expenses
      .filter(
        (expense) =>
          isActiveExpenseRecord(expense) &&
          predicate(expense) &&
          isInHalfOpenRange(expense.date, from, toExclusive)
      )
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
  );
}

export function sumRecordedUnpaidExpenses(
  expenses: ExpenseForAggregation[],
  from: Date,
  toExclusive: Date
) {
  return sumExpensesInRange(
    expenses,
    from,
    toExclusive,
    (expense) => expense.paymentStatus !== "PAID"
  );
}

export function sumPaidExpenseCashOut(
  expenses: ExpenseForAggregation[],
  from: Date,
  toExclusive: Date
) {
  return sumExpensesInRange(
    expenses,
    from,
    toExclusive,
    (expense) => expense.paymentStatus === "PAID"
  );
}

export function sumAccruedExpenses(
  expenses: ExpenseForAggregation[],
  from: Date,
  toExclusive: Date
) {
  return sumExpensesInRange(expenses, from, toExclusive, () => true);
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
  toExclusive?: Date
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
    if (from && toExclusive) {
      if (!isInHalfOpenRange(transaction.date, from, toExclusive)) {
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

/**
 * Combine cash P&L for period.
 * `to` defaults to inclusive (legacy endOfDay/endOfMonth) and is converted to
 * half-open via toExclusiveBound. Pass toMode: "exclusive" when `to` is already exclusive.
 */
export function combineFinanceBreakdown(
  accountTransactions: AccountTransactionLike[],
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date,
  options?: { toMode?: "inclusive" | "exclusive" }
): FinanceAggregationBreakdown {
  const toExclusive =
    options?.toMode === "exclusive" ? to : toExclusiveBound(to, "inclusive");
  const accountPart = aggregateAccountTransactions(
    accountTransactions,
    from,
    toExclusive
  );
  const recordedExpenseTotal = sumRecordedUnpaidExpenses(
    expenses,
    from,
    toExclusive
  );
  const paidExpenseTotal = sumPaidExpenseCashOut(expenses, from, toExclusive);
  const totalAccruedExpense = sumAccruedExpenses(expenses, from, toExclusive);
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

export function buildMonthlyCashFlowData(
  transactions: AccountTransactionLike[],
  expenses: ExpenseForAggregation[],
  from: Date,
  to: Date,
  maxMonths = 6,
  options?: { toMode?: "inclusive" | "exclusive"; timeZone?: string }
): MonthlyCashFlowPoint[] {
  const timeZone = options?.timeZone ?? COMPANY_FINANCE_TIMEZONE;
  const toExclusive =
    options?.toMode === "exclusive" ? to : toExclusiveBound(to, "inclusive");

  const buckets = iterateZonedMonthBuckets(
    from,
    toExclusive,
    timeZone,
    maxMonths
  );

  return buckets.map((bucket) => {
    const bucketFrom =
      bucket.from.getTime() < from.getTime() ? from : bucket.from;
    const bucketToExclusive =
      bucket.toExclusive.getTime() > toExclusive.getTime()
        ? toExclusive
        : bucket.toExclusive;

    const breakdown = combineFinanceBreakdown(
      transactions,
      expenses,
      bucketFrom,
      bucketToExclusive,
      { toMode: "exclusive" }
    );

    return {
      month: bucket.label,
      income: breakdown.totalIncome,
      expense: breakdown.totalExpense,
      net: roundCashMoney(breakdown.totalIncome - breakdown.totalExpense),
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
