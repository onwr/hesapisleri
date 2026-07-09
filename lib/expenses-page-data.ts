import { db } from "@/lib/prisma";
import { percentChange, startOfDay } from "@/lib/dashboard-metrics";
import {
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  resolveMonthFinancialPeriod,
  resolvePreviousMonthFinancialPeriod,
  zonedWallTimeToUtc,
} from "@/lib/finance/financial-period";
import { normalizeExpenseCategoryName } from "@/lib/expense-category-utils";
import {
  EXPENSE_CHART_COLORS,
  formatExpenseMoney,
  getExpenseDocumentNo,
  type ExpenseCategoryBreakdown,
  type ExpenseStatCard,
  type ExpenseTabKey,
  type ExpenseTableRow,
} from "@/lib/expenses-page-utils";

export type {
  ExpenseCategoryBreakdown,
  ExpenseStatCard,
  ExpenseTabKey,
  ExpenseTableRow,
} from "@/lib/expenses-page-utils";
export {
  buildConicGradient,
  buildExpensesExportQuery,
  buildExpensesQuery,
  EXPENSE_TAB_LABELS,
  formatExpenseDate,
  formatExpenseMoney,
  getCategoryBadge,
  getCategoryIconStyle,
  getExpenseStatusBadge,
  normalizeDateRange,
  parseDateParam,
  parseExpenseCategoryFilter,
  parseExpenseTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/expenses-page-utils";

const PAGE_SIZE = 10;

type ExpenseRecord = {
  id: string;
  title: string;
  category: string | null;
  supplier: string | null;
  amount: unknown;
  status: string;
  paymentStatus: string;
  date: Date;
  note: string | null;
};

function isActiveExpense(expense: ExpenseRecord) {
  return expense.status !== "CANCELLED";
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function filterByDateRange(expenses: ExpenseRecord[], from: Date, to: Date) {
  const toExclusive = new Date(endOfDay(to).getTime() + 1);
  return expenses.filter((expense) =>
    isInHalfOpenRange(expense.date, from, toExclusive)
  );
}

function sumAmount(rows: ExpenseRecord[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

function matchesSearch(expense: ExpenseRecord, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");
  const documentNo = getExpenseDocumentNo(expense).toLocaleLowerCase("tr-TR");

  return (
    expense.title.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (expense.category?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (expense.supplier?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (expense.note?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    documentNo.includes(normalized)
  );
}

function filterByTab(rows: ExpenseRecord[], tab: ExpenseTabKey) {
  switch (tab) {
    case "paid":
      return rows.filter(
        (row) => isActiveExpense(row) && row.paymentStatus === "PAID"
      );
    case "unpaid":
      return rows.filter(
        (row) => isActiveExpense(row) && row.paymentStatus === "UNPAID"
      );
    case "cancelled":
      return rows.filter((row) => row.status === "CANCELLED");
    default:
      return rows.filter(isActiveExpense);
  }
}

function filterByCategory(rows: ExpenseRecord[], category: string | null) {
  if (!category) return rows;

  return rows.filter(
    (row) => normalizeExpenseCategoryName(row.category) === category
  );
}

function toTableRow(expense: ExpenseRecord): ExpenseTableRow {
  return {
    id: expense.id,
    date: expense.date,
    title: expense.title,
    note: expense.note,
    categoryName: expense.category || "Diğer",
    supplier: expense.supplier,
    documentNo: getExpenseDocumentNo(expense),
    amount: Number(expense.amount),
    status: expense.status,
    paymentStatus: expense.paymentStatus,
  };
}

function computeAverageMonthly(expenses: ExpenseRecord[]) {
  const now = new Date();
  const bucketKeys = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}-${date.getMonth()}`;
  });

  const buckets = new Map(bucketKeys.map((key) => [key, 0]));

  for (const expense of expenses) {
    const key = `${expense.date.getFullYear()}-${expense.date.getMonth()}`;

    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(expense.amount));
    }
  }

  const totals = Array.from(buckets.values());
  return totals.reduce((sum, value) => sum + value, 0) / totals.length;
}

function buildCategoryBreakdown(
  expenses: ExpenseRecord[],
  totalOverride?: number
): ExpenseCategoryBreakdown[] {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const category = expense.category || "Diğer";
    totals.set(category, (totals.get(category) ?? 0) + Number(expense.amount));
  }

  const grandTotal =
    totalOverride ?? Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(totals.entries())
    .map(([category, total], index) => ({
      category,
      total,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      color: EXPENSE_CHART_COLORS[index % EXPENSE_CHART_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);
}

function buildChangeLabel(current: number, previous: number, invert = false) {
  const change = percentChange(current, previous);
  const improved = invert ? change <= 0 : change >= 0;

  return {
    change: `${change >= 0 ? "+" : ""}${change}%`.replace("+-", "-"),
    positive: improved,
  };
}

export async function getExpensesPageData(
  companyId: string,
  options: {
    tab: ExpenseTabKey;
    page: number;
    from: Date;
    to: Date;
    q?: string | null;
    category?: string | null;
  }
) {
  const now = new Date();
  const monthPeriod = resolveMonthFinancialPeriod({
    referenceDate: now,
    timezone: COMPANY_FINANCE_TIMEZONE,
  });
  const lastMonthPeriod = resolvePreviousMonthFinancialPeriod(
    now,
    COMPANY_FINANCE_TIMEZONE
  );
  const yearStart = zonedWallTimeToUtc(
    { year: now.getFullYear(), month: 1, day: 1 },
    COMPANY_FINANCE_TIMEZONE
  );
  const lastYearStart = zonedWallTimeToUtc(
    { year: now.getFullYear() - 1, month: 1, day: 1 },
    COMPANY_FINANCE_TIMEZONE
  );
  const lastYearExclusive = yearStart;

  const expenses = await db.expense.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
  });

  const activeExpenses = expenses.filter(isActiveExpense);

  const monthExpenses = activeExpenses.filter((expense) =>
    isInHalfOpenRange(
      expense.date,
      monthPeriod.from,
      monthPeriod.toExclusive
    )
  );
  const lastMonthExpenses = activeExpenses.filter((expense) =>
    isInHalfOpenRange(
      expense.date,
      lastMonthPeriod.from,
      lastMonthPeriod.toExclusive
    )
  );
  const thisYearExpenses = activeExpenses.filter(
    (expense) =>
      expense.date.getTime() >= yearStart.getTime() &&
      expense.date.getTime() < now.getTime() + 1
  );
  const lastYearExpenses = activeExpenses.filter((expense) =>
    isInHalfOpenRange(expense.date, lastYearStart, lastYearExclusive)
  );
  const unpaidExpenses = activeExpenses.filter(
    (expense) => expense.paymentStatus === "UNPAID"
  );

  const monthTotal = sumAmount(monthExpenses);
  const lastMonthTotal = sumAmount(lastMonthExpenses);
  const yearTotal = sumAmount(thisYearExpenses);
  const lastYearTotal = sumAmount(lastYearExpenses);
  const unpaidTotal = sumAmount(unpaidExpenses);
  const averageMonthly = computeAverageMonthly(activeExpenses);

  const highestExpense = activeExpenses.reduce<ExpenseRecord | null>((max, expense) => {
    if (!max || Number(expense.amount) > Number(max.amount)) {
      return expense;
    }

    return max;
  }, null);

  const monthChange = buildChangeLabel(monthTotal, lastMonthTotal, true);
  const yearChange = buildChangeLabel(yearTotal, lastYearTotal, true);

  const statCards: ExpenseStatCard[] = [
    {
      title: "Bu Ay Tahakkuk Gider",
      value: formatExpenseMoney(monthTotal),
      subtitle: `Geçen Ay: ${formatExpenseMoney(lastMonthTotal)} · ödeme durumundan bağımsız`,
      change: monthChange.change,
      positive: monthChange.positive,
      iconKey: "receipt",
      color: "blue",
    },
    {
      title: "Bu Yıl Toplam Gider",
      value: formatExpenseMoney(yearTotal),
      subtitle: `Geçen Yıl: ${formatExpenseMoney(lastYearTotal)}`,
      change: yearChange.change,
      positive: yearChange.positive,
      iconKey: "file",
      color: "blue",
    },
    {
      title: "En Yüksek Gider",
      value: highestExpense
        ? formatExpenseMoney(Number(highestExpense.amount))
        : formatExpenseMoney(0),
      subtitle: highestExpense?.title || "Kayıt yok",
      iconKey: "trending",
      color: "rose",
    },
    {
      title: "Ortalama Aylık Gider",
      value: formatExpenseMoney(averageMonthly),
      subtitle: "Son 12 ay ortalaması",
      iconKey: "wallet",
      color: "orange",
    },
    {
      title: "Ödenmemiş Gider",
      value: `${unpaidExpenses.length} Gider`,
      subtitle: formatExpenseMoney(unpaidTotal),
      iconKey: "hourglass",
      color: "violet",
    },
  ];

  const rangeFrom = startOfDay(options.from);
  let filteredExpenses = filterByDateRange(expenses, rangeFrom, options.to);
  filteredExpenses = filterByTab(filteredExpenses, options.tab);
  filteredExpenses = filterByCategory(filteredExpenses, options.category ?? null);

  if (options.q) {
    filteredExpenses = filteredExpenses.filter((expense) =>
      matchesSearch(expense, options.q!)
    );
  }

  const totalRecords = filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const rows = filteredExpenses
    .slice(startIndex, startIndex + PAGE_SIZE)
    .map(toTableRow);

  const monthlyBreakdown = buildCategoryBreakdown(monthExpenses, monthTotal);
  const categoryBreakdown = buildCategoryBreakdown(monthExpenses, monthTotal);

  return {
    statCards,
    rows,
    monthlyBreakdown,
    categoryBreakdown,
    monthlyTotal: monthTotal,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
  };
}

export async function getExpensesExportRows(
  companyId: string,
  options: {
    tab: ExpenseTabKey;
    from: Date;
    to: Date;
    q?: string | null;
    category?: string | null;
  }
) {
  const expenses = await db.expense.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
  });

  let filteredExpenses = filterByDateRange(
    expenses,
    startOfDay(options.from),
    options.to
  );
  filteredExpenses = filterByTab(filteredExpenses, options.tab);
  filteredExpenses = filterByCategory(filteredExpenses, options.category ?? null);

  if (options.q) {
    filteredExpenses = filteredExpenses.filter((expense) =>
      matchesSearch(expense, options.q!)
    );
  }

  return filteredExpenses;
}
