import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import {
  buildExpensePaymentTransactionTitle,
  isCancelledExpense,
  parseExpenseDate,
  validateExpensePayEligibility,
} from "@/lib/expense-utils";
import { ensureExpenseCategoryExists } from "@/lib/expense-category-service";
import { normalizeExpenseCategoryName } from "@/lib/expense-category-utils";
import { db } from "@/lib/prisma";

export type BulkPaymentStatusFilter = "all" | "PAID" | "UNPAID" | "CANCELLED";

export type BulkExpenseStatusFilter = "all" | "ACTIVE" | "CANCELLED";

export type ExpenseBulkFilters = {
  q: string | null;
  category: string | null;
  paymentStatus: BulkPaymentStatusFilter;
  status: BulkExpenseStatusFilter;
  from: Date | null;
  to: Date | null;
};

export type BulkExpenseRow = {
  id: string;
  date: Date;
  title: string;
  category: string;
  amount: number;
  paymentStatus: string;
  status: string;
  accountName: string | null;
  note: string | null;
};

export type BulkExpenseListSummary = {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  unpaidCount: number;
  paidAmount: number;
  unpaidAmount: number;
};

export type BulkSelectionSummary = {
  selectedCount: number;
  selectedAmount: number;
  paidSelectedAmount: number;
  unpaidSelectedAmount: number;
  topCategory: string | null;
};

type ExpenseSourceRow = {
  id: string;
  title: string;
  category: string | null;
  amount: unknown;
  paymentStatus: string;
  status: string;
  date: Date;
  note: string | null;
  account: { name: string } | null;
};

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function parseBulkPaymentStatus(
  value?: string | null
): BulkPaymentStatusFilter {
  if (value === "PAID" || value === "UNPAID" || value === "CANCELLED") {
    return value;
  }

  return "all";
}

export function parseBulkExpenseStatus(
  value?: string | null
): BulkExpenseStatusFilter {
  if (value === "ACTIVE" || value === "CANCELLED") {
    return value;
  }

  return "all";
}

export function parseBulkExpenseSearch(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function parseBulkExpenseCategory(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? normalizeExpenseCategoryName(trimmed) : null;
}

export function parseBulkExpenseFilters(searchParams: {
  q?: string | null;
  category?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
}): ExpenseBulkFilters {
  const from = searchParams.from ? parseExpenseDate(searchParams.from) : null;
  const to = searchParams.to ? parseExpenseDate(searchParams.to) : null;

  return {
    q: parseBulkExpenseSearch(searchParams.q),
    category: parseBulkExpenseCategory(searchParams.category),
    paymentStatus: parseBulkPaymentStatus(searchParams.paymentStatus),
    status: parseBulkExpenseStatus(searchParams.status),
    from,
    to,
  };
}

export function matchesBulkExpenseSearch(expense: ExpenseSourceRow, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    expense.title.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (expense.category?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (expense.note?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false)
  );
}

export function filterBulkExpenses(
  expenses: ExpenseSourceRow[],
  filters: ExpenseBulkFilters
) {
  let rows = [...expenses];

  if (filters.status === "ACTIVE") {
    rows = rows.filter((expense) => !isCancelledExpense(expense.status));
  } else if (filters.status === "CANCELLED") {
    rows = rows.filter((expense) => isCancelledExpense(expense.status));
  }

  if (filters.paymentStatus === "CANCELLED") {
    rows = rows.filter((expense) => isCancelledExpense(expense.status));
  } else if (filters.paymentStatus === "PAID") {
    rows = rows.filter(
      (expense) =>
        !isCancelledExpense(expense.status) && expense.paymentStatus === "PAID"
    );
  } else if (filters.paymentStatus === "UNPAID") {
    rows = rows.filter(
      (expense) =>
        !isCancelledExpense(expense.status) && expense.paymentStatus === "UNPAID"
    );
  }

  if (filters.category) {
    rows = rows.filter(
      (expense) =>
        normalizeExpenseCategoryName(expense.category) === filters.category
    );
  }

  if (filters.from && filters.to) {
    const end = endOfDay(filters.to);
    rows = rows.filter(
      (expense) => expense.date >= filters.from! && expense.date <= end
    );
  }

  if (filters.q) {
    rows = rows.filter((expense) => matchesBulkExpenseSearch(expense, filters.q!));
  }

  return rows;
}

export function toBulkExpenseRow(expense: ExpenseSourceRow): BulkExpenseRow {
  return {
    id: expense.id,
    date: expense.date,
    title: expense.title,
    category: normalizeExpenseCategoryName(expense.category),
    amount: Number(expense.amount),
    paymentStatus: expense.paymentStatus,
    status: expense.status,
    accountName: expense.account?.name ?? null,
    note: expense.note,
  };
}

export function summarizeBulkExpenseList(
  expenses: BulkExpenseRow[]
): BulkExpenseListSummary {
  let paidCount = 0;
  let unpaidCount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let totalAmount = 0;

  for (const expense of expenses) {
    if (isCancelledExpense(expense.status)) {
      continue;
    }

    totalAmount += expense.amount;

    if (expense.paymentStatus === "PAID") {
      paidCount += 1;
      paidAmount += expense.amount;
    } else {
      unpaidCount += 1;
      unpaidAmount += expense.amount;
    }
  }

  return {
    totalCount: expenses.length,
    totalAmount,
    paidCount,
    unpaidCount,
    paidAmount,
    unpaidAmount,
  };
}

export function summarizeBulkSelection(
  expenses: BulkExpenseRow[],
  selectedIds: Set<string>
): BulkSelectionSummary {
  const selected = expenses.filter((expense) => selectedIds.has(expense.id));

  let selectedAmount = 0;
  let paidSelectedAmount = 0;
  let unpaidSelectedAmount = 0;
  const categoryTotals = new Map<string, number>();

  for (const expense of selected) {
    if (isCancelledExpense(expense.status)) {
      continue;
    }

    selectedAmount += expense.amount;
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amount
    );

    if (expense.paymentStatus === "PAID") {
      paidSelectedAmount += expense.amount;
    } else {
      unpaidSelectedAmount += expense.amount;
    }
  }

  const topCategory =
    [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    selectedCount: selected.length,
    selectedAmount,
    paidSelectedAmount,
    unpaidSelectedAmount,
    topCategory,
  };
}

export async function getBulkExpenseList(
  companyId: string,
  filters: ExpenseBulkFilters
) {
  const expenses = await db.expense.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    include: {
      account: {
        select: { name: true },
      },
    },
  });

  const filtered = filterBulkExpenses(expenses, filters).map(toBulkExpenseRow);

  return {
    expenses: filtered,
    summary: summarizeBulkExpenseList(filtered),
  };
}

export async function bulkCancelExpenses(input: {
  companyId: string;
  userId: string;
  ids: string[];
}) {
  const uniqueIds = [...new Set(input.ids)];

  if (uniqueIds.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "En az bir gider seçin.",
    };
  }

  return db.$transaction(async (tx) => {
    const expenses = await tx.expense.findMany({
      where: {
        companyId: input.companyId,
        id: { in: uniqueIds },
      },
      include: {
        account: true,
        accountTransaction: true,
      },
    });

    let cancelledCount = 0;
    let skippedCount = 0;
    const supplierIds = new Set<string>();

    for (const expense of expenses) {
      if (isCancelledExpense(expense.status)) {
        skippedCount += 1;
        continue;
      }

      if (expense.paymentStatus === "PAID" && expense.accountId && expense.account) {
        const amount = roundCashMoney(Number(expense.amount));
        const newBalance = roundCashMoney(
          Number(expense.account.balance) + amount
        );

        await tx.account.update({
          where: { id: expense.account.id },
          data: { balance: newBalance },
        });

        if (expense.accountTransaction) {
          await tx.accountTransaction.delete({
            where: { id: expense.accountTransaction.id },
          });
        }
      }

      await tx.expense.update({
        where: { id: expense.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "UNPAID",
          accountId: null,
        },
      });

      if (expense.supplierId) {
        supplierIds.add(expense.supplierId);
      }

      cancelledCount += 1;
    }

    skippedCount += uniqueIds.length - expenses.length;

    if (cancelledCount > 0) {
      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "UPDATE",
          module: "expenses",
          message: `${cancelledCount} gider toplu iptal edildi.`,
        },
      });
    }

    return {
      ok: true as const,
      data: {
        cancelledCount,
        skippedCount,
        supplierIds: [...supplierIds],
      },
    };
  }).then(async (result) => {
    if (result.ok && result.data.supplierIds.length > 0) {
      for (const supplierId of result.data.supplierIds) {
        await syncSupplierBalance(input.companyId, supplierId);
      }
    }
    return result;
  });
}

export async function bulkChangeExpenseCategory(input: {
  companyId: string;
  userId: string;
  ids: string[];
  category: string;
}) {
  const uniqueIds = [...new Set(input.ids)];
  const category = normalizeExpenseCategoryName(input.category);

  if (uniqueIds.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "En az bir gider seçin.",
    };
  }

  await ensureExpenseCategoryExists(input.companyId, category);

  const result = await db.expense.updateMany({
    where: {
      companyId: input.companyId,
      id: { in: uniqueIds },
    },
    data: {
      category,
    },
  });

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "UPDATE",
      module: "expenses",
      message: `${result.count} giderin kategorisi "${category}" olarak güncellendi.`,
    },
  });

  return {
    ok: true as const,
    data: {
      updatedCount: result.count,
    },
  };
}

export async function bulkPayExpenses(input: {
  companyId: string;
  userId: string;
  ids: string[];
  accountId: string;
  paidAt?: string;
  note?: string;
}) {
  const uniqueIds = [...new Set(input.ids)];

  if (uniqueIds.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "En az bir gider seçin.",
    };
  }

  const paymentDate = input.paidAt?.trim()
    ? parseExpenseDate(input.paidAt)
    : new Date();

  if (input.paidAt?.trim() && !paymentDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir ödeme tarihi girin.",
    };
  }

  return db.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: {
        id: input.accountId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    });

    if (!account) {
      return {
        ok: false as const,
        status: 404,
        message: "Ödeme hesabı bulunamadı.",
      };
    }

    const expenses = await tx.expense.findMany({
      where: {
        companyId: input.companyId,
        id: { in: uniqueIds },
      },
      include: {
        accountTransaction: true,
      },
    });

    let paidCount = 0;
    let skippedCount = 0;
    let totalPaid = 0;
    let runningBalance = Number(account.balance);
    const supplierIds = new Set<string>();

    for (const expense of expenses) {
      const eligibility = validateExpensePayEligibility(expense);

      if (!eligibility.ok) {
        skippedCount += 1;
        continue;
      }

      const amount = roundCashMoney(Number(expense.amount));
      totalPaid = roundCashMoney(totalPaid + amount);
      runningBalance = roundCashMoney(runningBalance - amount);
      const paymentNote = input.note?.trim() || expense.note;

      await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          type: "EXPENSE",
          title: buildExpensePaymentTransactionTitle(expense.title),
          amount,
          date: paymentDate!,
          note: paymentNote,
          expenseId: expense.id,
        },
      });

      await tx.expense.update({
        where: { id: expense.id },
        data: {
          paymentStatus: "PAID",
          accountId: account.id,
        },
      });

      if (expense.supplierId) {
        supplierIds.add(expense.supplierId);
      }

      paidCount += 1;
    }

    if (paidCount > 0) {
      await tx.account.update({
        where: { id: account.id },
        data: { balance: runningBalance },
      });

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "UPDATE",
          module: "expenses",
          message: `${paidCount} gider toplu ödendi (${account.name}).`,
        },
      });
    }

    skippedCount += uniqueIds.length - expenses.length;

    return {
      ok: true as const,
      data: {
        paidCount,
        skippedCount,
        totalPaid,
        supplierIds: [...supplierIds],
      },
    };
  }).then(async (result) => {
    if (result.ok && result.data.supplierIds.length > 0) {
      for (const supplierId of result.data.supplierIds) {
        await syncSupplierBalance(input.companyId, supplierId);
      }
    }
    return result;
  });
}

export async function getBulkExpenseExportRows(
  companyId: string,
  options: {
    ids?: string[];
    filters?: ExpenseBulkFilters;
  }
) {
  if (options.ids && options.ids.length > 0) {
    const expenses = await db.expense.findMany({
      where: {
        companyId,
        id: { in: options.ids },
      },
      orderBy: { date: "desc" },
      include: {
        account: {
          select: { name: true },
        },
      },
    });

    return expenses.map(toBulkExpenseRow);
  }

  if (!options.filters) {
    return [];
  }

  const { expenses } = await getBulkExpenseList(companyId, options.filters);
  return expenses;
}
