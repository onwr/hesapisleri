import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";
import { percentChange, startOfDay } from "@/lib/dashboard-metrics";
import {
  CASH_RESULT_LABEL,
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  iterateZonedMonthBuckets,
  toExclusiveBound,
} from "@/lib/finance/financial-period";
import { formatDateTimeDisplay, toIsoString } from "@/lib/format-utils";

export type ReportTabKey = "all" | "financial" | "sales" | "stock" | "customer";

export type ReportViewKey =
  | "income-expense"
  | "cash-flow"
  | "sales"
  | "products"
  | "customers"
  | "stock";

export type ReportSections = {
  showKpi: boolean;
  showIncomeExpenseChart: boolean;
  showCashFlowChart: boolean;
  showCashFlowBreakdown: boolean;
  showExpenseCategories: boolean;
  showSalesSummary: boolean;
  showTopProducts: boolean;
  showStockSummary: boolean;
  showStockTable: boolean;
  showCustomerSummary: boolean;
};

export type MonthlyFinancePoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

export type ExpenseCategoryPoint = {
  name: string;
  value: number;
  percent: number;
};

export type TopProductPoint = {
  name: string;
  soldQty: number;
  revenue: number;
};

export type ReportKpiCard = {
  title: string;
  value: number;
  previousValue: number;
  changePercent: number;
  positive: boolean;
  color: "emerald" | "rose" | "blue";
  lineColor: string;
  miniLineData: Array<{ value: number }>;
};

export type ReportSummaryItem = {
  label: string;
  value: number;
  iconKey: "wallet" | "trendingDown" | "calendar" | "receipt" | "boxes";
  color: "emerald" | "rose" | "orange" | "violet" | "blue";
};

export type ReportCardItem = {
  key: string;
  title: string;
  description: string;
  tab: ReportTabKey;
  href?: string;
  iconKey:
    | "trendingUp"
    | "wallet"
    | "barChart"
    | "package"
    | "users"
    | "boxes";
  color: "emerald" | "blue" | "orange" | "violet" | "rose" | "cyan";
};

export const REPORT_TAB_LABELS: Record<ReportTabKey, string> = {
  all: "Tüm Raporlar",
  financial: "Finansal",
  sales: "Satış",
  stock: "Stok",
  customer: "Müşteri",
};

export const REPORT_CARDS: ReportCardItem[] = [
  {
    key: "income-expense",
    title: "Gelir - Gider Raporu",
    description: "Kazancınızı görün",
    tab: "financial",
    iconKey: "trendingUp",
    color: "emerald",
  },
  {
    key: "cash-flow",
    title: "Nakit Akış Raporu",
    description: "Para giriş çıkışlarınız",
    tab: "financial",
    iconKey: "wallet",
    color: "blue",
  },
  {
    key: "sales",
    title: "Satış Raporu",
    description: "Satışlarınızı analiz edin",
    tab: "sales",
    iconKey: "barChart",
    color: "orange",
  },
  {
    key: "products",
    title: "Ürün Raporu",
    description: "Ürün performansları",
    tab: "stock",
    iconKey: "package",
    color: "violet",
  },
  {
    key: "customers",
    title: "Müşteri Raporu",
    description: "Müşteri analizleri",
    tab: "customer",
    iconKey: "users",
    color: "rose",
  },
  {
    key: "stock",
    title: "Stok Raporu",
    description: "Stok durum raporu",
    tab: "stock",
    iconKey: "boxes",
    color: "cyan",
  },
  {
    key: "personnel-performance",
    title: "Personel Performansı",
    description: "Çalışan satış ve verimlilik analizi",
    tab: "all",
    href: "/reports/personnel-performance",
    iconKey: "users",
    color: "blue",
  },
];

export function parseReportTab(value?: string | null): ReportTabKey {
  if (
    value === "financial" ||
    value === "sales" ||
    value === "stock" ||
    value === "customer"
  ) {
    return value;
  }

  return "all";
}

const REPORT_VIEW_KEYS = new Set<ReportViewKey>([
  "income-expense",
  "cash-flow",
  "sales",
  "products",
  "customers",
  "stock",
]);

export function parseReportView(value?: string | null): ReportViewKey | null {
  if (!value || !REPORT_VIEW_KEYS.has(value as ReportViewKey)) {
    return null;
  }

  return value as ReportViewKey;
}

export function getReportCardByKey(key: string) {
  return REPORT_CARDS.find((card) => card.key === key);
}

export function resolveReportSections(
  activeReport: ReportViewKey | null,
  activeTab: ReportTabKey
): ReportSections {
  if (activeReport === "income-expense") {
    return {
      showKpi: true,
      showIncomeExpenseChart: true,
      showCashFlowChart: false,
      showCashFlowBreakdown: false,
      showExpenseCategories: true,
      showSalesSummary: false,
      showTopProducts: false,
      showStockSummary: false,
      showStockTable: false,
      showCustomerSummary: false,
    };
  }

  if (activeReport === "cash-flow") {
    return {
      showKpi: true,
      showIncomeExpenseChart: false,
      showCashFlowChart: true,
      showCashFlowBreakdown: true,
      showExpenseCategories: false,
      showSalesSummary: false,
      showTopProducts: false,
      showStockSummary: false,
      showStockTable: false,
      showCustomerSummary: false,
    };
  }

  if (activeReport === "sales") {
    return {
      showKpi: false,
      showIncomeExpenseChart: false,
      showCashFlowChart: false,
      showCashFlowBreakdown: false,
      showExpenseCategories: false,
      showSalesSummary: true,
      showTopProducts: true,
      showStockSummary: false,
      showStockTable: false,
      showCustomerSummary: false,
    };
  }

  if (activeReport === "products") {
    return {
      showKpi: false,
      showIncomeExpenseChart: false,
      showCashFlowChart: false,
      showCashFlowBreakdown: false,
      showExpenseCategories: false,
      showSalesSummary: false,
      showTopProducts: true,
      showStockSummary: false,
      showStockTable: false,
      showCustomerSummary: false,
    };
  }

  if (activeReport === "customers") {
    return {
      showKpi: false,
      showIncomeExpenseChart: false,
      showCashFlowChart: false,
      showCashFlowBreakdown: false,
      showExpenseCategories: false,
      showSalesSummary: false,
      showTopProducts: false,
      showStockSummary: false,
      showStockTable: false,
      showCustomerSummary: true,
    };
  }

  if (activeReport === "stock") {
    return {
      showKpi: false,
      showIncomeExpenseChart: false,
      showCashFlowChart: false,
      showCashFlowBreakdown: false,
      showExpenseCategories: false,
      showSalesSummary: false,
      showTopProducts: false,
      showStockSummary: true,
      showStockTable: true,
      showCustomerSummary: false,
    };
  }

  const showFinancial = tabShowsFinancial(activeTab);
  const showSales = tabShowsSales(activeTab);
  const showStock = tabShowsStock(activeTab);
  const showCustomer = tabShowsCustomer(activeTab);

  return {
    showKpi: showFinancial,
    showIncomeExpenseChart: showFinancial,
    showCashFlowChart: showFinancial,
    showCashFlowBreakdown: showFinancial,
    showExpenseCategories: showFinancial,
    showSalesSummary: showSales,
    showTopProducts: showSales,
    showStockSummary: showStock,
    showStockTable: showStock,
    showCustomerSummary: showCustomer,
  };
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export { formatMoney as formatReportMoney } from "@/lib/format-utils";

export function sanitizeReportNumber(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatReportDateTime(
  date: Date | string | number | null | undefined
) {
  return formatDateTimeDisplay(date);
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getShortMonth(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
  }).format(date);
}

export function getPreviousPeriod(from: Date, to: Date) {
  const fromStart = startOfDay(from);
  const toEnd = endOfDay(to);
  const durationMs = toEnd.getTime() - fromStart.getTime();
  const prevTo = new Date(fromStart.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return {
    from: startOfDay(prevFrom),
    to: endOfDay(prevTo),
  };
}

export function getMonthBuckets(from: Date, to: Date, maxMonths = 6) {
  const toExclusive = toExclusiveBound(to, "inclusive");
  return iterateZonedMonthBuckets(
    from,
    toExclusive,
    COMPANY_FINANCE_TIMEZONE,
    maxMonths
  ).map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    start: bucket.from,
    end: new Date(bucket.toExclusive.getTime() - 1),
    toExclusive: bucket.toExclusive,
  }));
}

export function isInRange(date: Date, from: Date, to: Date) {
  const toExclusive = toExclusiveBound(to, "inclusive");
  return isInHalfOpenRange(date, from, toExclusive);
}

export function buildMonthlyFinanceData(
  sales: Array<{ total: unknown; createdAt: Date }>,
  expenses: Array<{ amount: unknown; date: Date }>,
  from: Date,
  to: Date
): MonthlyFinancePoint[] {
  return getMonthBuckets(from, to).map((bucket) => {
    const bucketFrom =
      bucket.start.getTime() < from.getTime() ? from : bucket.start;
    const bucketToExclusive =
      bucket.toExclusive.getTime() > toExclusiveBound(to).getTime()
        ? toExclusiveBound(to)
        : bucket.toExclusive;

    const income = sales
      .filter((sale) =>
        isInHalfOpenRange(sale.createdAt, bucketFrom, bucketToExclusive)
      )
      .reduce((sum, sale) => sum + Number(sale.total), 0);

    const expense = expenses
      .filter((item) =>
        isInHalfOpenRange(item.date, bucketFrom, bucketToExclusive)
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      month: bucket.label,
      income,
      expense,
      net: income - expense,
    };
  });
}

export function buildMiniLineData(
  points: MonthlyFinancePoint[],
  key: "income" | "expense" | "net"
) {
  const values = points.map((point) => sanitizeReportNumber(point[key]));

  if (values.length === 0) {
    return [{ value: 0 }];
  }

  return values.map((value) => ({ value }));
}

export function buildReportKpiCards(
  currentIncome: number,
  currentExpense: number,
  monthlyFinanceData: MonthlyFinancePoint[],
  previousIncome: number,
  previousExpense: number
): ReportKpiCard[] {
  const currentNet = currentIncome - currentExpense;
  const previousNet = previousIncome - previousExpense;

  return [
    {
      title: "Nakit Gelir",
      value: sanitizeReportNumber(currentIncome),
      previousValue: sanitizeReportNumber(previousIncome),
      changePercent: sanitizeReportNumber(
        percentChange(currentIncome, previousIncome)
      ),
      positive: currentIncome >= previousIncome,
      color: "emerald",
      lineColor: "#22c55e",
      miniLineData: buildMiniLineData(monthlyFinanceData, "income"),
    },
    {
      title: "Nakit Gider",
      value: sanitizeReportNumber(currentExpense),
      previousValue: sanitizeReportNumber(previousExpense),
      changePercent: sanitizeReportNumber(
        percentChange(currentExpense, previousExpense)
      ),
      positive: currentExpense <= previousExpense,
      color: "rose",
      lineColor: "#fb7185",
      miniLineData: buildMiniLineData(monthlyFinanceData, "expense"),
    },
    {
      title: CASH_RESULT_LABEL,
      value: sanitizeReportNumber(currentNet),
      previousValue: sanitizeReportNumber(previousNet),
      changePercent: sanitizeReportNumber(percentChange(currentNet, previousNet)),
      positive: currentNet >= previousNet,
      color: "blue",
      lineColor: "#3b82f6",
      miniLineData: buildMiniLineData(monthlyFinanceData, "net"),
    },
  ];
}

export function buildReportsQuery(params: {
  tab?: ReportTabKey;
  report?: ReportViewKey | null;
  from?: Date | string;
  to?: Date | string;
}) {
  const search = new URLSearchParams();

  if (params.report) {
    search.set("report", params.report);
  } else if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  const query = search.toString();
  return query ? `/reports?${query}` : "/reports";
}

export function buildReportsExportQuery(params: {
  tab?: ReportTabKey;
  report?: ReportViewKey | null;
  from?: Date | string;
  to?: Date | string;
}) {
  const search = new URLSearchParams();

  if (params.report) {
    search.set("report", params.report);
  } else if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  const query = search.toString();
  return query ? `/api/reports/export?${query}` : "/api/reports/export";
}

export function tabShowsFinancial(tab: ReportTabKey) {
  return tab === "all" || tab === "financial";
}

export function tabShowsSales(tab: ReportTabKey) {
  return tab === "all" || tab === "sales";
}

export function tabShowsStock(tab: ReportTabKey) {
  return tab === "all" || tab === "stock";
}

export function tabShowsCustomer(tab: ReportTabKey) {
  return tab === "all" || tab === "customer";
}

export function filterReportCards(
  tab: ReportTabKey,
  activeReport?: ReportViewKey | null
) {
  if (activeReport) {
    return REPORT_CARDS;
  }

  if (tab === "all") {
    return REPORT_CARDS;
  }

  return REPORT_CARDS.filter((card) => card.tab === tab);
}

export function buildReportCardHref(
  card: ReportCardItem,
  from: Date,
  to: Date
) {
  if (card.href) {
    return card.href;
  }

  return buildReportsQuery({
    report: card.key as ReportViewKey,
    from,
    to,
  });
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
