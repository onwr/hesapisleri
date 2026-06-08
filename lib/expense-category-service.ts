import { db } from "@/lib/prisma";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { normalizeExpenseCategory } from "@/lib/expense-utils";
import {
  DEFAULT_EXPENSE_CATEGORY_NAME,
  DEFAULT_EXPENSE_CATEGORY_SEED,
  getDefaultExpenseCategoryColor,
  isDefaultExpenseCategoryName,
  normalizeExpenseCategoryName,
  type ExpenseCategoryColor,
} from "@/lib/expense-category-utils";

type ExpenseForStats = {
  category: string | null;
  amount: unknown;
  paymentStatus: string;
  status: string;
  date: Date;
};

type ExpenseCategoryRecord = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  sortOrder: number;
  status: string;
};

export type ExpenseCategoryStats = {
  expenseCount: number;
  paidExpenseCount: number;
  unpaidExpenseCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  thisMonthAmount: number;
  lastExpenseDate: Date | null;
};

export type ExpenseCategoryWithStats = {
  id: string;
  name: string;
  color: string | null;
  note: string | null;
  sortOrder: number;
  status: string;
  expenseCount: number;
  paidExpenseCount: number;
  unpaidExpenseCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  thisMonthAmount: number;
  lastExpenseDate: Date | null;
};

export type ExpenseCategoriesPageSummary = {
  totalCategories: number;
  activeCategories: number;
  totalExpenseAmount: number;
  thisMonthAmount: number;
  unpaidAmount: number;
};

export function computeExpenseCategoryStats(
  expenses: ExpenseForStats[],
  categoryName: string
): ExpenseCategoryStats {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const members = expenses.filter(
    (expense) =>
      expense.status !== "CANCELLED" &&
      normalizeExpenseCategoryName(expense.category) === categoryName
  );

  let paidExpenseCount = 0;
  let unpaidExpenseCount = 0;
  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let thisMonthAmount = 0;
  let lastExpenseDate: Date | null = null;

  for (const expense of members) {
    const amount = Number(expense.amount);
    totalAmount += amount;

    if (expense.paymentStatus === "PAID") {
      paidExpenseCount += 1;
      paidAmount += amount;
    } else {
      unpaidExpenseCount += 1;
      unpaidAmount += amount;
    }

    if (expense.date >= monthStart && expense.date <= monthEnd) {
      thisMonthAmount += amount;
    }

    if (!lastExpenseDate || expense.date > lastExpenseDate) {
      lastExpenseDate = expense.date;
    }
  }

  return {
    expenseCount: members.length,
    paidExpenseCount,
    unpaidExpenseCount,
    totalAmount,
    paidAmount,
    unpaidAmount,
    thisMonthAmount,
    lastExpenseDate,
  };
}

export function summarizeExpenseCategoriesPage(
  categories: ExpenseCategoryRecord[],
  expenses: ExpenseForStats[]
): ExpenseCategoriesPageSummary {
  const activeExpenses = expenses.filter(
    (expense) => expense.status !== "CANCELLED"
  );

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let totalExpenseAmount = 0;
  let thisMonthAmount = 0;
  let unpaidAmount = 0;

  for (const expense of activeExpenses) {
    const amount = Number(expense.amount);
    totalExpenseAmount += amount;

    if (expense.date >= monthStart && expense.date <= monthEnd) {
      thisMonthAmount += amount;
    }

    if (expense.paymentStatus === "UNPAID") {
      unpaidAmount += amount;
    }
  }

  return {
    totalCategories: categories.length,
    activeCategories: categories.filter((category) => category.status === "ACTIVE")
      .length,
    totalExpenseAmount,
    thisMonthAmount,
    unpaidAmount,
  };
}

export async function ensureDefaultExpenseCategories(companyId: string) {
  await db.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORY_SEED.map((category) => ({
      companyId,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder,
    })),
    skipDuplicates: true,
  });
}

export async function syncOrphanExpenseCategories(companyId: string) {
  const [expenses, categories] = await Promise.all([
    db.expense.findMany({
      where: { companyId },
      select: { category: true },
    }),
    db.expenseCategory.findMany({
      where: { companyId },
      select: { name: true },
    }),
  ]);

  const existingNames = new Set(
    categories.map((category) => category.name)
  );
  const orphanNames = new Set<string>();

  for (const expense of expenses) {
    const name = normalizeExpenseCategoryName(expense.category);

    if (!existingNames.has(name)) {
      orphanNames.add(name);
    }
  }

  if (orphanNames.size === 0) {
    return;
  }

  await db.expenseCategory.createMany({
    data: [...orphanNames].map((name, index) => ({
      companyId,
      name,
      color: getDefaultExpenseCategoryColor(name),
      sortOrder: 100 + index,
    })),
    skipDuplicates: true,
  });
}

export async function prepareExpenseCategories(companyId: string) {
  await ensureDefaultExpenseCategories(companyId);
  await syncOrphanExpenseCategories(companyId);
}

export async function getExpenseCategoriesWithStats(companyId: string) {
  await prepareExpenseCategories(companyId);

  const [categories, expenses] = await Promise.all([
    db.expenseCategory.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.expense.findMany({
      where: { companyId },
      select: {
        category: true,
        amount: true,
        paymentStatus: true,
        status: true,
        date: true,
      },
    }),
  ]);

  const mapped = categories.map((category: ExpenseCategoryRecord) => {
    const stats = computeExpenseCategoryStats(expenses, category.name);

    return {
      id: category.id,
      name: category.name,
      color: category.color,
      note: category.note,
      sortOrder: category.sortOrder,
      status: category.status,
      ...stats,
    } satisfies ExpenseCategoryWithStats;
  });

  return {
    categories: mapped,
    summary: summarizeExpenseCategoriesPage(categories, expenses),
  };
}

export async function getActiveExpenseCategoryNames(companyId: string) {
  await prepareExpenseCategories(companyId);

  const categories = await db.expenseCategory.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });

  return categories.map((category) => category.name);
}

export async function getExpenseCategoryColorMap(companyId: string) {
  const { categories } = await getExpenseCategoriesWithStats(companyId);

  return Object.fromEntries(
    categories.map((category) => [category.name, category.color])
  );
}

export async function ensureExpenseCategoryExists(
  companyId: string,
  rawName?: string | null
) {
  const name = normalizeExpenseCategory(rawName);
  await prepareExpenseCategories(companyId);

  const existing = await db.expenseCategory.findFirst({
    where: { companyId, name },
  });

  if (existing) {
    return existing;
  }

  return db.expenseCategory.create({
    data: {
      companyId,
      name,
      color: getDefaultExpenseCategoryColor(name),
      sortOrder: 100,
    },
  });
}

export async function createExpenseCategory(
  companyId: string,
  input: { name: string; color?: string; note?: string }
) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Kategori adı zorunludur.");
  }

  const existing = await db.expenseCategory.findFirst({
    where: { companyId, name },
  });

  if (existing) {
    throw new Error("Bu isimde bir kategori zaten var.");
  }

  return db.expenseCategory.create({
    data: {
      companyId,
      name,
      color: (input.color as ExpenseCategoryColor) || getDefaultExpenseCategoryColor(name),
      note: input.note?.trim() || null,
      sortOrder: 100,
      status: "ACTIVE",
    },
  });
}

export async function updateExpenseCategory(
  companyId: string,
  categoryId: string,
  input: {
    name?: string;
    color?: string;
    note?: string | null;
    status?: "ACTIVE" | "PASSIVE";
  }
) {
  const category = await db.expenseCategory.findFirst({
    where: { id: categoryId, companyId },
  });

  if (!category) {
    throw new Error("Kategori bulunamadı.");
  }

  const nextName = input.name?.trim();
  const nextColor = input.color?.trim();
  const nextNote =
    input.note === undefined ? undefined : input.note?.trim() || null;
  const nextStatus = input.status;

  if (nextName && nextName !== category.name) {
    const duplicate = await db.expenseCategory.findFirst({
      where: {
        companyId,
        name: nextName,
        NOT: { id: category.id },
      },
    });

    if (duplicate) {
      throw new Error("Bu isimde bir kategori zaten var.");
    }
  }

  return db.$transaction(async (tx) => {
    if (nextName && nextName !== category.name) {
      await tx.expense.updateMany({
        where: {
          companyId,
          category: category.name,
        },
        data: {
          category: nextName,
        },
      });
    }

    return tx.expenseCategory.update({
      where: { id: category.id },
      data: {
        ...(nextName ? { name: nextName } : {}),
        ...(nextColor ? { color: nextColor } : {}),
        ...(nextNote !== undefined ? { note: nextNote } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
      },
    });
  });
}

export async function deleteExpenseCategory(companyId: string, categoryId: string) {
  const category = await db.expenseCategory.findFirst({
    where: { id: categoryId, companyId },
  });

  if (!category) {
    throw new Error("Kategori bulunamadı.");
  }

  if (isDefaultExpenseCategoryName(category.name)) {
    throw new Error("Diğer kategorisi silinemez.");
  }

  const expenseCount = await db.expense.count({
    where: {
      companyId,
      category: category.name,
    },
  });

  if (expenseCount > 0) {
    throw new Error(
      "Bu kategoride gider kayıtları var. Önce giderleri başka kategoriye taşıyın veya kategoriyi pasife alın."
    );
  }

  await db.expenseCategory.delete({
    where: { id: category.id },
  });
}
