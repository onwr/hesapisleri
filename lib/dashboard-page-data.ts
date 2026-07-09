import { db } from "@/lib/prisma";
import {
  buildDashboardAiInsights,
  buildDailySalesChart,
  percentChange,
  sumSalesTotal,
} from "@/lib/dashboard-metrics";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import { sumActiveAccountBalances } from "@/lib/finance-aggregation-utils";
import { buildCanonicalFinancialSummary } from "@/lib/finance/financial-summary-service";
import {
  ACCRUAL_PROFIT_LABEL,
  ACCRUAL_SALES_BY_CREATED_AT_LABEL,
  CASH_RESULT_LABEL,
  CASH_RESULT_TOOLTIP,
  COMPANY_FINANCE_TIMEZONE,
  prismaHalfOpenCreatedAt,
  resolveMonthFinancialPeriod,
  resolvePreviousMonthFinancialPeriod,
  startOfNextZonedDay,
  startOfZonedDay,
} from "@/lib/finance/financial-period";
import {
  getCompanyAccountTransactions,
  getCompanyExpensesForFinance,
} from "@/lib/finance-aggregation-service";
import { buildExpensesQuery } from "@/lib/expenses-page-utils";
import { buildInvoicesQuery } from "@/lib/invoices-page-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { buildSalesQuery, formatDateInputValue } from "@/lib/sales-page-utils";
import {
  resolveDashboardStatLinks,
  type DashboardStatLinks,
} from "@/lib/dashboard-ui-utils";
import { formatMoney } from "@/lib/format-utils";
import { resolveDashboardReferenceDate } from "@/lib/dashboard-period-utils";

export type DashboardPageData = {
  periodKey: string;
  monthLabel: string;
  todaySales: number;
  yesterdaySales: number;
  todaySalesChange: number;
  monthSales: number;
  lastMonthSales: number;
  monthSalesChange: number;
  pendingCollection: number;
  dueCollection: number;
  monthExpenses: number;
  totalAccountBalance: number;
  accountsCount: number;
  salesChartData: Array<{ day: string; amount: number; label: string }>;
  incomeExpense: {
    income: number;
    expense: number;
    profit: number;
    accrualProfit: number | null;
    financeMirrorOutTotal: number;
    cashNet: number;
    revenueLabel: string;
    expenseLabel: string;
    profitLabel: string;
    profitTooltip: string;
    accrualProfitLabel: string;
    salesBasisLabel: string;
    basisNote: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    bankName: string | null;
    iban: string | null;
    type: string;
    balanceFormatted: string;
  }>;
  upcomingPayments: Array<{
    id: string;
    title: string;
    amountFormatted: string;
    dueDateFormatted: string;
    daysLeft: number;
    href: string;
  }>;
  statLinks: DashboardStatLinks;
  aiInsights: string[];
};

export type DashboardPageDataInput = {
  companyId: string;
  periodKey: string;
};

export async function getDashboardPageDataUncached(
  input: DashboardPageDataInput
): Promise<DashboardPageData> {
  const now = resolveDashboardReferenceDate(input.periodKey);
  const tz = COMPANY_FINANCE_TIMEZONE;
  const todayStart = startOfZonedDay(now, tz);
  const todayExclusive = startOfNextZonedDay(now, tz);
  const yesterdayStart = startOfZonedDay(
    new Date(todayStart.getTime() - 1),
    tz
  );
  const yesterdayExclusive = todayStart;

  const monthPeriod = resolveMonthFinancialPeriod({
    referenceDate: now,
    timezone: tz,
  });
  const lastMonthPeriod = resolvePreviousMonthFinancialPeriod(now, tz);

  const saleWhereBase = {
    companyId: input.companyId,
    ...activeSaleStatusFilter(),
  };

  const [
    todaySalesRows,
    yesterdaySalesRows,
    monthSalesRows,
    lastMonthSalesRows,
    allExpensesRows,
    unpaidInvoices,
    accounts,
    upcomingInvoices,
    accountTransactions,
  ] = await Promise.all([
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: { gte: todayStart, lt: todayExclusive },
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: { gte: yesterdayStart, lt: yesterdayExclusive },
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: prismaHalfOpenCreatedAt(monthPeriod),
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: prismaHalfOpenCreatedAt(lastMonthPeriod),
      },
      select: { total: true, createdAt: true },
    }),
    getCompanyExpensesForFinance(input.companyId),
    db.invoice.findMany({
      where: {
        companyId: input.companyId,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        saleId: null,
      },
      select: {
        total: true,
        paidAmount: true,
        dueDate: true,
      },
    }),
    db.account.findMany({
      where: { companyId: input.companyId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        bankName: true,
        iban: true,
        type: true,
        balance: true,
      },
    }),
    db.invoice.findMany({
      where: {
        companyId: input.companyId,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        dueDate: { gte: now },
        saleId: null,
      },
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        paidAmount: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    getCompanyAccountTransactions(input.companyId),
  ]);

  const todaySales = sumSalesTotal(todaySalesRows);
  const yesterdaySales = sumSalesTotal(yesterdaySalesRows);
  const monthSales = sumSalesTotal(monthSalesRows);
  const lastMonthSales = sumSalesTotal(lastMonthSalesRows);

  const monthSummary = buildCanonicalFinancialSummary(
    accountTransactions,
    allExpensesRows,
    monthPeriod.from,
    monthPeriod.toExclusive,
    { toMode: "exclusive", accrualSalesTotal: monthSales }
  );
  const lastMonthSummary = buildCanonicalFinancialSummary(
    accountTransactions,
    allExpensesRows,
    lastMonthPeriod.from,
    lastMonthPeriod.toExclusive,
    { toMode: "exclusive", accrualSalesTotal: lastMonthSales }
  );

  const monthExpenses = monthSummary.expenses.cashTotal;
  const monthCashIncome = monthSummary.revenue.total;
  const profit = monthSummary.profit.operational;

  const pendingCollection = unpaidInvoices.reduce(
    (sum, invoice) =>
      sum +
      getInvoiceRemainingAmount(Number(invoice.total), Number(invoice.paidAmount)),
    0
  );

  const dueCollection = unpaidInvoices
    .filter((invoice) => invoice.dueDate && invoice.dueDate <= now)
    .reduce(
      (sum, invoice) =>
        sum +
        getInvoiceRemainingAmount(Number(invoice.total), Number(invoice.paidAmount)),
      0
    );

  const totalAccountBalance = sumActiveAccountBalances(accounts);
  const salesChartData = buildDailySalesChart(
    monthSalesRows,
    monthPeriod.from,
    monthPeriod.toExclusive
  );

  const statLinks = resolveDashboardStatLinks({
    todaySales: buildSalesQuery({
      from: formatDateInputValue(todayStart),
      to: formatDateInputValue(now),
    }),
    monthSales: buildSalesQuery({
      from: formatDateInputValue(monthPeriod.from),
      to: formatDateInputValue(monthPeriod.toInclusive),
    }),
    pendingCollection: buildInvoicesQuery({
      tab: dueCollection > 0 ? "overdue" : "pending",
      from: monthPeriod.from,
      to: monthPeriod.toInclusive,
    }),
    // Nakit gider → ödenmiş gider filtresi (aynı metrik kapsamı)
    monthExpenses: buildExpensesQuery({
      tab: "paid",
      from: monthPeriod.from,
      to: monthPeriod.toInclusive,
    }),
    cashBank: "/cash-bank",
  });

  return {
    periodKey: input.periodKey,
    monthLabel: monthPeriod.label,
    todaySales,
    yesterdaySales,
    todaySalesChange: percentChange(todaySales, yesterdaySales),
    monthSales,
    lastMonthSales,
    monthSalesChange: percentChange(monthSales, lastMonthSales),
    pendingCollection,
    dueCollection,
    monthExpenses,
    totalAccountBalance,
    accountsCount: accounts.length,
    salesChartData,
    incomeExpense: {
      income: monthCashIncome,
      expense: monthExpenses,
      profit,
      accrualProfit: monthSummary.profit.accrual,
      financeMirrorOutTotal: monthSummary.adjustments.financeMirrorOutTotal,
      cashNet: monthSummary.profit.cashNet,
      revenueLabel: "Nakit Gelir",
      expenseLabel: "Nakit Gider",
      profitLabel: CASH_RESULT_LABEL,
      profitTooltip: CASH_RESULT_TOOLTIP,
      accrualProfitLabel: ACCRUAL_PROFIT_LABEL,
      salesBasisLabel: ACCRUAL_SALES_BY_CREATED_AT_LABEL,
      basisNote:
        "Seçili dönemde kasa/banka tahsilatları ve ödenen giderler esas alınır. Transfer ve ters kayıtlar dahil değildir.",
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      iban: account.iban,
      type: account.type,
      balanceFormatted: formatMoney(Number(account.balance)),
    })),
    upcomingPayments: upcomingInvoices
      .filter((invoice) => invoice.dueDate)
      .map((invoice) => {
        const dueDate = invoice.dueDate!;
        const daysLeft = Math.max(
          0,
          Math.ceil(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        return {
          id: invoice.id,
          title:
            invoice.customer?.name ||
            invoice.invoiceNo ||
            "Ödeme bekleyen fatura",
          amountFormatted: formatMoney(
            getInvoiceRemainingAmount(
              Number(invoice.total),
              Number(invoice.paidAmount)
            )
          ),
          dueDateFormatted: new Intl.DateTimeFormat("tr-TR").format(dueDate),
          daysLeft,
          href: `/invoices/${invoice.id}`,
        };
      }),
    statLinks,
    aiInsights: buildDashboardAiInsights(
      monthSales,
      lastMonthSales,
      monthExpenses,
      lastMonthSummary.expenses.cashTotal,
      pendingCollection
    ),
  };
}

/** Eski cache kayıtlarındaki `aiInsight` alanını da destekler. */
export function resolveDashboardAiInsights(
  data: Partial<Pick<DashboardPageData, "aiInsights">> & {
    aiInsight?: string;
  }
): string[] {
  if (Array.isArray(data.aiInsights) && data.aiInsights.length > 0) {
    return data.aiInsights;
  }

  if (typeof data.aiInsight === "string" && data.aiInsight.trim()) {
    return [data.aiInsight];
  }

  return [];
}
