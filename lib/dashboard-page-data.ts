import { db } from "@/lib/prisma";
import {
  buildDashboardAiInsights,
  buildDailySalesChart,
  endOfLastMonth,
  endOfMonth,
  endOfYesterday,
  getMonthLabel,
  percentChange,
  startOfDay,
  startOfLastMonth,
  startOfMonth,
  startOfYesterday,
  sumSalesTotal,
} from "@/lib/dashboard-metrics";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import {
  combineFinanceBreakdown,
  sumActiveAccountBalances,
} from "@/lib/finance-aggregation-utils";
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
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfYesterday(now);
  const yesterdayEnd = endOfYesterday(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

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
        createdAt: { gte: todayStart },
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: { total: true, createdAt: true },
    }),
    db.sale.findMany({
      where: {
        ...saleWhereBase,
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
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
        saleId: null,
        dueDate: { gte: now },
      },
      include: {
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

  const monthFinance = combineFinanceBreakdown(
    accountTransactions,
    allExpensesRows,
    monthStart,
    monthEnd
  );
  const lastMonthFinance = combineFinanceBreakdown(
    accountTransactions,
    allExpensesRows,
    lastMonthStart,
    lastMonthEnd
  );

  const monthExpenses = monthFinance.totalExpense;
  const monthCashIncome = monthFinance.totalIncome;
  const profit = monthFinance.netCashFlow;

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
  const salesChartData = buildDailySalesChart(monthSalesRows, monthStart);

  const statLinks = resolveDashboardStatLinks({
    todaySales: buildSalesQuery({
      from: formatDateInputValue(todayStart),
      to: formatDateInputValue(now),
    }),
    monthSales: buildSalesQuery({
      from: formatDateInputValue(monthStart),
      to: formatDateInputValue(monthEnd),
    }),
    pendingCollection: buildInvoicesQuery({
      tab: dueCollection > 0 ? "overdue" : "pending",
      from: monthStart,
      to: monthEnd,
    }),
    monthExpenses: buildExpensesQuery({
      from: monthStart,
      to: monthEnd,
    }),
    cashBank: "/cash-bank",
  });

  return {
    periodKey: input.periodKey,
    monthLabel: getMonthLabel(now),
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
      lastMonthFinance.totalExpense,
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
