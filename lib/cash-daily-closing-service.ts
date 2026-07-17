import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  getTransactionSignedAmount,
  roundCashMoney,
} from "@/lib/cash-bank-account-utils";
import {
  calculateClosingDifference,
  computeExpectedCashAtPeriodEnd,
  resolveClosingPeriod,
  summarizeAccountTransactionsForPeriod,
  validateCountedCashAmount,
} from "@/lib/cash-daily-closing-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { runTransactionWithRetry } from "@/lib/prisma-transaction-utils";

export class CashDailyClosingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CashDailyClosingError";
    this.status = status;
  }
}

type TxClient = Prisma.TransactionClient;

function isUniqueConstraint(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function loadAccountOrThrow(
  client: Pick<typeof db, "account"> | TxClient,
  companyId: string,
  accountId: string
) {
  const account = await client.account.findFirst({
    where: {
      id: accountId,
      companyId,
      type: "CASH",
      status: "ACTIVE",
    },
  });

  if (!account) {
    throw new CashDailyClosingError("Kasa hesabı bulunamadı.", 404);
  }

  return account;
}

async function loadAccountTransactions(
  client: Pick<typeof db, "accountTransaction"> | TxClient,
  accountId: string
) {
  return client.accountTransaction.findMany({
    where: { accountId },
    select: {
      id: true,
      type: true,
      title: true,
      note: true,
      amount: true,
      date: true,
      createdAt: true,
    },
    orderBy: { date: "asc" },
  });
}

async function computeSalePaymentSummaries(input: {
  client: Pick<typeof db, "salePayment" | "sale"> | TxClient;
  companyId: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const payments = await input.client.salePayment.findMany({
    where: {
      companyId: input.companyId,
      createdAt: {
        gte: input.periodStart,
        lt: input.periodEnd,
      },
      sale: {
        status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
        companyId: input.companyId,
      },
    },
    select: {
      paymentMethod: true,
      amount: true,
      accountId: true,
    },
  });

  let totalCashSales = 0;
  let totalCardSales = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount);
    if (payment.paymentMethod === "CASH" && payment.accountId === input.accountId) {
      totalCashSales = roundCashMoney(totalCashSales + amount);
    }
    if (payment.paymentMethod === "CARD") {
      totalCardSales = roundCashMoney(totalCardSales + amount);
    }
  }

  const creditSales = await input.client.sale.findMany({
    where: {
      companyId: input.companyId,
      status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
      createdAt: {
        gte: input.periodStart,
        lt: input.periodEnd,
      },
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    },
    select: {
      total: true,
      paidAmount: true,
      returns: {
        where: { status: "COMPLETED" },
        select: { totalReturnAmount: true, totalCreditAdjustment: true },
      },
    },
  });

  let totalCreditSales = 0;
  for (const sale of creditSales) {
    const refunded = sale.returns.reduce(
      (sum, row) => sum + Number(row.totalReturnAmount),
      0
    );
    const effectiveTotal = roundCashMoney(
      Math.max(0, Number(sale.total) - refunded)
    );
    const remaining = roundCashMoney(
      Math.max(0, effectiveTotal - Number(sale.paidAmount))
    );
    totalCreditSales = roundCashMoney(totalCreditSales + remaining);
  }

  return {
    totalCashSales,
    totalCardSales,
    totalCreditSales,
  };
}

export async function previewCashDailyClosing(input: {
  companyId: string;
  accountId: string;
  closingDate: Date | string;
}) {
  const period = resolveClosingPeriod(input.closingDate);
  const account = await loadAccountOrThrow(db, input.companyId, input.accountId);
  const transactions = await loadAccountTransactions(db, account.id);
  const mapped = transactions.map((tx) => ({
    ...tx,
    amount: Number(tx.amount),
  }));

  const expectedCashAmount = computeExpectedCashAtPeriodEnd({
    currentBalance: Number(account.balance),
    transactions: mapped,
    periodEnd: period.periodEnd,
  });

  const periodSummary = summarizeAccountTransactionsForPeriod({
    transactions: mapped,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  const saleSummary = await computeSalePaymentSummaries({
    client: db,
    companyId: input.companyId,
    accountId: account.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  const existing = await db.cashDailyClosing.findFirst({
    where: {
      companyId: input.companyId,
      accountId: account.id,
      closingDate: period.closingDate,
    },
    select: {
      id: true,
      status: true,
      countedCashAmount: true,
      differenceAmount: true,
      closedAt: true,
    },
  });

  return {
    account: {
      id: account.id,
      name: account.name,
      balance: Number(account.balance),
    },
    closingDate: period.closingDate.toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    expectedCashAmount,
    periodNet: periodSummary.periodNet,
    totalCashSales: saleSummary.totalCashSales,
    totalCardSales: saleSummary.totalCardSales,
    totalCreditSales: saleSummary.totalCreditSales,
    totalCollections: periodSummary.totalCollections,
    totalExpenses: periodSummary.totalExpenses,
    totalRefunds: periodSummary.totalRefunds,
    totalTransfersIn: periodSummary.totalTransfersIn,
    totalTransfersOut: periodSummary.totalTransfersOut,
    existingClosing: existing
      ? {
          id: existing.id,
          status: existing.status,
          countedCashAmount: Number(existing.countedCashAmount),
          differenceAmount: Number(existing.differenceAmount),
          closedAt: existing.closedAt.toISOString(),
        }
      : null,
  };
}

export async function createCashDailyClosing(input: {
  companyId: string;
  userId: string;
  accountId: string;
  closingDate: Date | string;
  countedCashAmount: unknown;
  note?: string | null;
}) {
  const counted = validateCountedCashAmount(input.countedCashAmount);
  if (!counted.ok) {
    throw new CashDailyClosingError(counted.message);
  }

  const period = resolveClosingPeriod(input.closingDate);

  try {
    const closing = await runTransactionWithRetry(async (tx) => {
      const account = await loadAccountOrThrow(tx, input.companyId, input.accountId);

      const duplicate = await tx.cashDailyClosing.findFirst({
        where: {
          companyId: input.companyId,
          accountId: account.id,
          closingDate: period.closingDate,
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new CashDailyClosingError(
          "Bu gün için kasa kapanışı zaten yapılmış.",
          409
        );
      }

      const transactions = await loadAccountTransactions(tx, account.id);
      const mapped = transactions.map((txRow) => ({
        ...txRow,
        amount: Number(txRow.amount),
      }));

      const expectedCashAmount = computeExpectedCashAtPeriodEnd({
        currentBalance: Number(account.balance),
        transactions: mapped,
        periodEnd: period.periodEnd,
      });

      const differenceAmount = calculateClosingDifference(
        expectedCashAmount,
        counted.amount
      );

      const periodSummary = summarizeAccountTransactionsForPeriod({
        transactions: mapped,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });

      const saleSummary = await computeSalePaymentSummaries({
        client: tx,
        companyId: input.companyId,
        accountId: account.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });

      const created = await tx.cashDailyClosing.create({
        data: {
          companyId: input.companyId,
          accountId: account.id,
          closingDate: period.closingDate,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          expectedCashAmount,
          countedCashAmount: counted.amount,
          differenceAmount,
          totalCashSales: saleSummary.totalCashSales,
          totalCardSales: saleSummary.totalCardSales,
          totalCreditSales: saleSummary.totalCreditSales,
          totalCollections: periodSummary.totalCollections,
          totalExpenses: periodSummary.totalExpenses,
          totalRefunds: periodSummary.totalRefunds,
          totalTransfersIn: periodSummary.totalTransfersIn,
          totalTransfersOut: periodSummary.totalTransfersOut,
          note: input.note?.trim() || null,
          status: "CLOSED",
          closedByUserId: input.userId,
          closedAt: new Date(),
        },
        include: {
          account: { select: { id: true, name: true } },
          closedByUser: { select: { id: true, name: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "CREATE",
          module: "cash-bank",
          message: `${account.name} için ${period.closingDate.toISOString().slice(0, 10)} gün sonu kasa kapanışı oluşturuldu. Fark: ${differenceAmount}`,
        },
      });

      return created;
    });

    invalidateDashboardCache(input.companyId, "cash-daily-close", {
      accountId: input.accountId,
    });

    return closing;
  } catch (error) {
    if (error instanceof CashDailyClosingError) throw error;
    if (isUniqueConstraint(error)) {
      throw new CashDailyClosingError(
        "Bu gün için kasa kapanışı zaten yapılmış.",
        409
      );
    }
    throw error;
  }
}

export async function listCashDailyClosings(input: {
  companyId: string;
  accountId?: string;
  take?: number;
}) {
  const rows = await db.cashDailyClosing.findMany({
    where: {
      companyId: input.companyId,
      ...(input.accountId ? { accountId: input.accountId } : {}),
    },
    include: {
      account: { select: { id: true, name: true } },
      closedByUser: { select: { id: true, name: true } },
    },
    orderBy: [{ closingDate: "desc" }, { closedAt: "desc" }],
    take: input.take ?? 50,
  });

  return rows.map((row) => ({
    id: row.id,
    closingDate: row.closingDate.toISOString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    account: row.account,
    expectedCashAmount: Number(row.expectedCashAmount),
    countedCashAmount: Number(row.countedCashAmount),
    differenceAmount: Number(row.differenceAmount),
    totalCashSales: Number(row.totalCashSales),
    totalCardSales: Number(row.totalCardSales),
    totalCreditSales: Number(row.totalCreditSales),
    totalCollections: Number(row.totalCollections),
    totalExpenses: Number(row.totalExpenses),
    totalRefunds: Number(row.totalRefunds),
    totalTransfersIn: Number(row.totalTransfersIn),
    totalTransfersOut: Number(row.totalTransfersOut),
    note: row.note,
    status: row.status,
    closedAt: row.closedAt.toISOString(),
    closedByUser: row.closedByUser,
  }));
}

export async function getCashDailyClosingById(input: {
  companyId: string;
  closingId: string;
}) {
  const row = await db.cashDailyClosing.findFirst({
    where: {
      id: input.closingId,
      companyId: input.companyId,
    },
    include: {
      account: { select: { id: true, name: true, type: true } },
      closedByUser: { select: { id: true, name: true } },
    },
  });

  if (!row) {
    throw new CashDailyClosingError("Kapanış kaydı bulunamadı.", 404);
  }

  return {
    id: row.id,
    closingDate: row.closingDate.toISOString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    account: row.account,
    expectedCashAmount: Number(row.expectedCashAmount),
    countedCashAmount: Number(row.countedCashAmount),
    differenceAmount: Number(row.differenceAmount),
    totalCashSales: Number(row.totalCashSales),
    totalCardSales: Number(row.totalCardSales),
    totalCreditSales: Number(row.totalCreditSales),
    totalCollections: Number(row.totalCollections),
    totalExpenses: Number(row.totalExpenses),
    totalRefunds: Number(row.totalRefunds),
    totalTransfersIn: Number(row.totalTransfersIn),
    totalTransfersOut: Number(row.totalTransfersOut),
    note: row.note,
    status: row.status,
    closedAt: row.closedAt.toISOString(),
    closedByUser: row.closedByUser,
  };
}

/** Test helper: period net via signed amounts (no double-count). */
export function sumSignedInPeriod(
  transactions: Array<{
    type: string;
    title: string;
    amount: number;
    date: Date;
  }>,
  periodStart: Date,
  periodEnd: Date
) {
  return roundCashMoney(
    transactions
      .filter(
        (tx) =>
          tx.date.getTime() >= periodStart.getTime() &&
          tx.date.getTime() < periodEnd.getTime()
      )
      .reduce((sum, tx) => sum + getTransactionSignedAmount(tx), 0)
  );
}
