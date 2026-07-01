import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { resolveSupplierBalanceView } from "@/lib/supplier-balance-utils";
import {
  buildSupplierAccountSummary,
  buildSupplierLedgerRunningBalance,
  expenseLedgerDebitCredit,
  expensePaymentLedgerDebitCredit,
  getSupplierLedgerTypeLabel,
  ledgerEntryDebitCredit,
  mapPrismaLedgerType,
  type SupplierLedgerRow,
} from "@/lib/supplier-ledger-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";

export type SupplierDetailLedgerData = {
  summary: ReturnType<typeof buildSupplierAccountSummary> & {
    lastMovementDate: string | null;
    overduePayable: number;
    totalPurchases: number;
  };
  ledger: SupplierLedgerRow[];
  linkedCustomer: {
    id: string;
    name: string;
    balance: number;
    href: string;
  } | null;
};

export async function getSupplierDetailLedgerData(
  companyId: string,
  supplierId: string
): Promise<SupplierDetailLedgerData | null> {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: {
      id: true,
      name: true,
      openingBalance: true,
      openingBalanceDate: true,
      openingBalanceNote: true,
      currentBalance: true,
      linkedCustomerId: true,
      linkedCustomer: {
        select: { id: true, name: true, balance: true },
      },
    },
  });

  if (!supplier) return null;

  await syncSupplierBalance(companyId, supplierId);

  const refreshed = await db.supplier.findFirstOrThrow({
    where: { id: supplierId, companyId },
    select: { currentBalance: true },
  });

  const [expenses, ledgerEntries, purchaseAgg, lastLedger] = await Promise.all([
    db.expense.findMany({
      where: { companyId, supplierId },
      orderBy: { date: "asc" },
      include: {
        accountTransaction: {
          select: {
            id: true,
            amount: true,
            date: true,
            accountId: true,
            account: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.supplierLedgerEntry.findMany({
      where: { companyId, supplierId },
      orderBy: { date: "asc" },
      include: {
        accountTransaction: {
          select: {
            id: true,
            accountId: true,
            account: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.expense.aggregate({
      where: { companyId, supplierId, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    }),
    db.supplierLedgerEntry.findFirst({
      where: { companyId, supplierId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  const rawRows: Array<Omit<SupplierLedgerRow, "balance" | "balanceDirection">> = [];

  const openingSigned = roundCashMoney(Number(supplier.openingBalance));
  if (openingSigned !== 0) {
    const { debit, credit } =
      openingSigned > 0
        ? { debit: openingSigned, credit: 0 }
        : { debit: 0, credit: Math.abs(openingSigned) };

    rawRows.push({
      id: `opening-${supplier.id}`,
      date: (supplier.openingBalanceDate ?? new Date(0)).toISOString(),
      type: "OPENING_BALANCE",
      typeLabel: getSupplierLedgerTypeLabel("OPENING_BALANCE"),
      description: supplier.openingBalanceNote?.trim() || "Açılış bakiyesi",
      debit,
      credit,
      relatedEntityId: null,
      relatedEntityHref: null,
      accountId: null,
      accountName: null,
      accountTransactionId: null,
      createdByUserId: null,
    });
  }

  const expensePaymentTxIds = new Set(
    expenses
      .map((expense) => expense.accountTransaction?.id)
      .filter((id): id is string => Boolean(id))
  );

  for (const expense of expenses) {
    const amount = roundCashMoney(Number(expense.amount));
    const { debit, credit } = expenseLedgerDebitCredit({
      amount,
      paymentStatus: expense.paymentStatus,
      status: expense.status,
    });

    if (debit > 0 || credit > 0) {
      rawRows.push({
        id: `expense-accrual-${expense.id}`,
        date: expense.date.toISOString(),
        type: "EXPENSE",
        typeLabel: getSupplierLedgerTypeLabel("EXPENSE"),
        description: expense.title,
        debit,
        credit,
        relatedEntityId: expense.id,
        relatedEntityHref: `/expenses/${expense.id}`,
        accountId: null,
        accountName: null,
        accountTransactionId: null,
        createdByUserId: expense.userId,
      });
    }

    if (expense.paymentStatus === "PAID" && expense.accountTransaction) {
      const pay = expensePaymentLedgerDebitCredit(amount);
      rawRows.push({
        id: `expense-pay-${expense.id}`,
        date: expense.accountTransaction.date.toISOString(),
        type: "PAYMENT",
        typeLabel: getSupplierLedgerTypeLabel("PAYMENT"),
        description: `${expense.title} ödemesi`,
        debit: pay.debit,
        credit: pay.credit,
        relatedEntityId: expense.id,
        relatedEntityHref: `/expenses/${expense.id}`,
        accountId: expense.accountTransaction.accountId,
        accountName: expense.accountTransaction.account.name,
        accountTransactionId: expense.accountTransaction.id,
        createdByUserId: expense.userId,
      });
    }
  }

  for (const entry of ledgerEntries) {
    if (entry.type === "OPENING_BALANCE") continue;

    const rowType = mapPrismaLedgerType(entry.type);
    const { debit, credit } = ledgerEntryDebitCredit(
      Number(entry.balanceEffect),
      Number(entry.amount)
    );

    rawRows.push({
      id: entry.id,
      date: entry.date.toISOString(),
      type: rowType,
      typeLabel: getSupplierLedgerTypeLabel(rowType),
      description: entry.description?.trim() || entry.reason?.trim() || rowType,
      debit,
      credit,
      relatedEntityId: entry.expenseId,
      relatedEntityHref: entry.expenseId ? `/expenses/${entry.expenseId}` : null,
      accountId: entry.accountTransaction?.accountId ?? null,
      accountName: entry.accountTransaction?.account.name ?? null,
      accountTransactionId: entry.accountTransaction?.id ?? null,
      createdByUserId: entry.createdByUserId,
    });
  }

  rawRows.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const ledger = buildSupplierLedgerRunningBalance(rawRows);
  const signedBalance = roundCashMoney(Number(refreshed.currentBalance));
  const view = resolveSupplierBalanceView(signedBalance);

  const lastExpense = expenses.length > 0 ? expenses[expenses.length - 1] : null;
  const lastMovementDate =
    lastLedger?.date.toISOString() ??
    lastExpense?.date.toISOString() ??
    null;

  return {
    summary: {
      ...buildSupplierAccountSummary(signedBalance),
      lastMovementDate,
      overduePayable: view.payableAmount,
      totalPurchases: roundCashMoney(Number(purchaseAgg._sum.amount ?? 0)),
    },
    ledger,
    linkedCustomer: supplier.linkedCustomer
      ? {
          id: supplier.linkedCustomer.id,
          name: supplier.linkedCustomer.name,
          balance: roundCashMoney(Number(supplier.linkedCustomer.balance)),
          href: `/customers/${supplier.linkedCustomer.id}`,
        }
      : null,
  };
}
