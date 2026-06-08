import { db } from "@/lib/prisma";
import {
  combineFinanceBreakdown,
  mapAccountTransactions,
  type FinanceAggregationBreakdown,
} from "@/lib/finance-aggregation-utils";

export async function getCompanyExpensesForFinance(companyId: string) {
  const rows = await db.expense.findMany({
    where: { companyId },
    select: {
      amount: true,
      date: true,
      status: true,
      paymentStatus: true,
    },
  });

  return rows.map((row) => ({
    amount: row.amount,
    date: row.date,
    paymentStatus: row.paymentStatus,
    status: row.status,
  }));
}

export async function getCompanyAccountTransactions(companyId: string) {
  const rows = await db.accountTransaction.findMany({
    where: {
      account: { companyId },
    },
    select: {
      id: true,
      date: true,
      createdAt: true,
      title: true,
      note: true,
      amount: true,
      type: true,
      expenseId: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return mapAccountTransactions(rows);
}

export async function getCompanyFinanceBreakdown(
  companyId: string,
  from: Date,
  to: Date,
  expenses?: Array<{
    amount: unknown;
    date: Date;
    paymentStatus?: string | null;
    status?: string | null;
  }>
): Promise<FinanceAggregationBreakdown> {
  const [transactions, expenseRows] = await Promise.all([
    getCompanyAccountTransactions(companyId),
    expenses
      ? Promise.resolve(expenses)
      : getCompanyExpensesForFinance(companyId),
  ]);

  return combineFinanceBreakdown(transactions, expenseRows, from, to);
}
