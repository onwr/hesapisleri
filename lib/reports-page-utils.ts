import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";
import { endOfMonth, percentChange, startOfDay, startOfMonth } from "@/lib/dashboard-metrics";

export type ReportTabKey = "all" | "financial" | "sales" | "stock" | "customer";

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

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export { formatMoney as formatReportMoney } from "@/lib/format-utils";

export function formatReportDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const buckets: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
  }> = [];

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

  return buckets;
}

export function isInRange(date: Date, from: Date, to: Date) {
  const value = date.getTime();
  return value >= startOfDay(from).getTime() && value <= endOfDay(to).getTime();
}

export function buildMonthlyFinanceData(
  sales: Array<{ total: unknown; createdAt: Date }>,
  expenses: Array<{ amount: unknown; date: Date }>,
  from: Date,
  to: Date
): MonthlyFinancePoint[] {
  return getMonthBuckets(from, to).map((bucket) => {
    const bucketFrom =
      bucket.start.getTime() < startOfDay(from).getTime() ? from : bucket.start;
    const bucketTo =
      bucket.end.getTime() > endOfDay(to).getTime() ? to : bucket.end;

    const income = sales
      .filter((sale) => isInRange(sale.createdAt, bucketFrom, bucketTo))
      .reduce((sum, sale) => sum + Number(sale.total), 0);

    const expense = expenses
      .filter((item) => isInRange(item.date, bucketFrom, bucketTo))
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
  const values = points.map((point) => point[key]);

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
      title: "Toplam Gelir",
      value: currentIncome,
      previousValue: previousIncome,
      changePercent: percentChange(currentIncome, previousIncome),
      positive: currentIncome >= previousIncome,
      color: "emerald",
      lineColor: "#22c55e",
      miniLineData: buildMiniLineData(monthlyFinanceData, "income"),
    },
    {
      title: "Toplam Gider",
      value: currentExpense,
      previousValue: previousExpense,
      changePercent: percentChange(currentExpense, previousExpense),
      positive: currentExpense <= previousExpense,
      color: "rose",
      lineColor: "#fb7185",
      miniLineData: buildMiniLineData(monthlyFinanceData, "expense"),
    },
    {
      title: "Net Kâr",
      value: currentNet,
      previousValue: previousNet,
      changePercent: percentChange(currentNet, previousNet),
      positive: currentNet >= previousNet,
      color: "blue",
      lineColor: "#3b82f6",
      miniLineData: buildMiniLineData(monthlyFinanceData, "net"),
    },
  ];
}

export function buildReportsQuery(params: {
  tab?: ReportTabKey;
  from?: Date | string;
  to?: Date | string;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
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
  from?: Date | string;
  to?: Date | string;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
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

export function filterReportCards(tab: ReportTabKey) {
  if (tab === "all") {
    return REPORT_CARDS;
  }

  return REPORT_CARDS.filter((card) => card.tab === tab);
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
