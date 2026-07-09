import { calculateInventoryValue } from "@/lib/inventory-value-utils";
import { db } from "@/lib/prisma";
import { toIsoString } from "@/lib/format-utils";
import {
  buildMonthlyCashFlowData,
  sumActiveAccountBalances,
} from "@/lib/finance-aggregation-utils";
import { buildCanonicalFinancialSummary } from "@/lib/finance/financial-summary-service";
import {
  COMPANY_FINANCE_TIMEZONE,
  resolveMonthFinancialPeriod,
} from "@/lib/finance/financial-period";
import { getCompanyAccountTransactions } from "@/lib/finance-aggregation-service";
import {
  buildReportKpiCards,
  endOfDay,
  isInRange,
  getPreviousPeriod,
  type ExpenseCategoryPoint,
  type MonthlyFinancePoint,
  type ReportCardItem,
  type ReportKpiCard,
  type ReportSummaryItem,
  type ReportTabKey,
  type TopProductPoint,
  REPORT_CARDS,
} from "@/lib/reports-page-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import {
  activeSaleStatusFilter,
  CANCELLED_SALE_STATUSES,
} from "@/lib/sale-query-utils";

export type StockReportItem = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  buyPrice: number;
  stockValue: number;
  isLowStock: boolean;
};

export type CustomerReportItem = {
  id: string;
  name: string;
  balance: number;
  kind: "receivable" | "payable";
};

export {
  REPORT_CARDS,
  REPORT_TAB_LABELS,
  buildReportCardHref,
  buildReportsExportQuery,
  buildReportsQuery,
  filterReportCards,
  formatDateDisplay,
  formatDateInputValue,
  formatReportDateTime,
  formatReportMoney,
  getReportCardByKey,
  normalizeDateRange,
  parseDateParam,
  parseReportTab,
  parseReportView,
  resolveReportSections,
  tabShowsCustomer,
  tabShowsFinancial,
  tabShowsSales,
  tabShowsStock,
} from "@/lib/reports-page-utils";

export type {
  ExpenseCategoryPoint,
  MonthlyFinancePoint,
  ReportCardItem,
  ReportKpiCard,
  ReportSections,
  ReportSummaryItem,
  ReportTabKey,
  ReportViewKey,
  TopProductPoint,
} from "@/lib/reports-page-utils";

export async function getReportsPageData(
  companyId: string,
  options: {
    tab: ReportTabKey;
    from: Date;
    to: Date;
  }
) {
  const { from, to } = options;
  const previousPeriod = getPreviousPeriod(from, to);
  const now = new Date();

  const [sales, expenses, invoices, products, customers, unpaidExpenses, paymentTransactions, accounts, accountTransactions] =
    await Promise.all([
      db.sale.findMany({
        where: {
          companyId,
          ...activeSaleStatusFilter(),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.expense.findMany({
        where: { companyId },
        orderBy: { date: "desc" },
      }),
      db.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      }),
      db.product.findMany({
        where: { companyId },
        include: {
          saleItems: {
            include: {
              sale: true,
            },
          },
        },
      }),
      db.customer.findMany({
        where: { companyId },
      }),
      db.expense.findMany({
        where: {
          companyId,
          status: { not: "CANCELLED" },
          paymentStatus: "UNPAID",
        },
      }),
      db.accountTransaction.findMany({
        where: {
          type: "PAYMENT",
          account: { companyId },
        },
        include: {
          account: true,
        },
      }),
      db.account.findMany({
        where: { companyId },
      }),
      getCompanyAccountTransactions(companyId),
    ]);

  const periodSales = sales.filter((sale) => isInRange(sale.createdAt, from, to));
  const periodExpenses = expenses.filter((expense) =>
    isInRange(expense.date, from, to)
  );

  const previousSales = sales.filter((sale) =>
    isInRange(sale.createdAt, previousPeriod.from, previousPeriod.to)
  );
  const previousExpenses = expenses.filter((expense) =>
    isInRange(expense.date, previousPeriod.from, previousPeriod.to)
  );

  const totalSalesAccrual = periodSales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0
  );

  const financeSummary = buildCanonicalFinancialSummary(
    accountTransactions,
    expenses,
    from,
    to,
    { toMode: "inclusive", accrualSalesTotal: totalSalesAccrual }
  );
  const previousFinanceSummary = buildCanonicalFinancialSummary(
    accountTransactions,
    expenses,
    previousPeriod.from,
    previousPeriod.to,
    { toMode: "inclusive" }
  );

  const totalIncome = financeSummary.revenue.total;
  const totalExpenses = financeSummary.expenses.cashTotal;
  const previousIncomeTotal = previousFinanceSummary.revenue.total;
  const previousExpensesTotal = previousFinanceSummary.expenses.cashTotal;
  const financeBreakdown = financeSummary.breakdown;
  const previousFinanceBreakdown = previousFinanceSummary.breakdown;

  const monthlyFinanceData = buildMonthlyCashFlowData(
    accountTransactions,
    expenses,
    from,
    to,
    6,
    { toMode: "inclusive", timeZone: COMPANY_FINANCE_TIMEZONE }
  ).map(({ month, income, expense, net }) => ({
    month,
    income,
    expense,
    net,
  }));

  const kpiCards = buildReportKpiCards(
    totalIncome,
    totalExpenses,
    monthlyFinanceData,
    previousIncomeTotal,
    previousExpensesTotal
  );

  const expenseCategoryMap = periodExpenses
    .filter((expense) => expense.status !== "CANCELLED")
    .reduce((map, expense) => {
    const key = expense.category || "Diğer";
    map.set(key, (map.get(key) || 0) + Number(expense.amount));
    return map;
  }, new Map<string, number>());

  if (financeBreakdown.manualCashExpense > 0) {
    expenseCategoryMap.set(
      "Kasa/Banka Çıkış",
      (expenseCategoryMap.get("Kasa/Banka Çıkış") || 0) +
        financeBreakdown.manualCashExpense
    );
  }

  const categoryExpenseTotal =
    financeBreakdown.totalAccruedExpense + financeBreakdown.manualCashExpense;

  const expenseCategories: ExpenseCategoryPoint[] = Array.from(expenseCategoryMap)
    .map(([name, value]) => ({
      name,
      value,
      percent:
        categoryExpenseTotal > 0
          ? Math.round((value / categoryExpenseTotal) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topProducts: TopProductPoint[] = products
    .map((product) => {
      const relevantItems = product.saleItems.filter(
        (item) =>
          isInRange(item.sale.createdAt, from, to) &&
          !CANCELLED_SALE_STATUSES.includes(
            item.sale.status as (typeof CANCELLED_SALE_STATUSES)[number]
          )
      );

      const soldQty = relevantItems.reduce((sum, item) => sum + item.quantity, 0);
      const revenue = relevantItems.reduce(
        (sum, item) => sum + Number(item.total),
        0
      );

      return {
        name: product.name,
        soldQty,
        revenue,
      };
    })
    .filter((item) => item.soldQty > 0 || item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const stockItems: StockReportItem[] = products
    .filter((product) => product.productType === "STOCK")
    .map((product) => {
      const buyPrice = Number(product.buyPrice);
      const stock = product.stock;

      return {
        id: product.id,
        name: product.name,
        stock,
        minStock: product.minStock,
        buyPrice,
        stockValue: stock * buyPrice,
        isLowStock: stock <= product.minStock,
      };
    })
    .sort((a, b) => a.stock - b.stock);

  const lowStockCount = stockItems.filter((item) => item.isLowStock).length;
  const trackedStockCount = stockItems.length;
  const salesCount = periodSales.length;
  const averageSaleAmount =
    salesCount > 0 ? totalSalesAccrual / salesCount : 0;

  const customerReportItems: CustomerReportItem[] = customers
    .map((customer) => {
      const balance = Number(customer.balance);

      if (balance === 0) {
        return null;
      }

      return {
        id: customer.id,
        name: customer.name,
        balance: Math.abs(balance),
        kind: balance < 0 ? "receivable" : "payable",
      } as CustomerReportItem;
    })
    .filter((item): item is CustomerReportItem => item !== null)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const stockValue = calculateInventoryValue(products);

  const customerDebt = customers
    .filter((customer) => Number(customer.balance) > 0)
    .reduce((sum, customer) => sum + Number(customer.balance), 0);

  const customerReceivable = Math.abs(
    customers
      .filter((customer) => Number(customer.balance) < 0)
      .reduce((sum, customer) => sum + Number(customer.balance), 0)
  );

  const unpaidInvoiceAmount = invoices
    .filter(
      (invoice) =>
        invoice.status !== "CANCELLED" &&
        !invoice.saleId &&
        invoice.paymentStatus !== "PAID" &&
        (invoice.dueDate
          ? invoice.dueDate.getTime() <= endOfDay(to).getTime()
          : isInRange(invoice.createdAt, from, to))
    )
    .reduce(
      (sum, invoice) =>
        sum +
        getInvoiceRemainingAmount(Number(invoice.total), Number(invoice.paidAmount)),
      0
    );

  const unpaidExpenseTotal = unpaidExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );
  const pendingPaymentTotal = paymentTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount),
    0
  );
  const duePayables = unpaidExpenseTotal + pendingPaymentTotal;

  const accountBalance = sumActiveAccountBalances(accounts);

  const summaryItems: ReportSummaryItem[] = [
    {
      label: "Toplam Alacak",
      value: customerReceivable,
      iconKey: "wallet",
      color: "emerald",
    },
    {
      label: "Toplam Borç",
      value: customerDebt,
      iconKey: "trendingDown",
      color: "rose",
    },
    {
      label: "Vadesi Gelen Alacak",
      value: unpaidInvoiceAmount,
      iconKey: "calendar",
      color: "orange",
    },
    {
      label: "Vadesi Gelen Borç",
      value: duePayables,
      iconKey: "receipt",
      color: "violet",
    },
    {
      label: "Stok Değeri",
      value: stockValue,
      iconKey: "boxes",
      color: "blue",
    },
    {
      label: "Kasa/Banka Bakiyesi",
      value: accountBalance,
      iconKey: "wallet",
      color: "blue",
    },
  ];

  const latestUpdate = [
    ...sales.map((item) => item.updatedAt),
    ...expenses.map((item) => item.updatedAt),
    ...invoices.map((item) => item.updatedAt),
    ...products.map((item) => item.updatedAt),
    ...customers.map((item) => item.updatedAt),
  ].reduce((latest, date) => (date > latest ? date : latest), now);

  const fromMonth = resolveMonthFinancialPeriod({
    referenceDate: from,
    timezone: COMPANY_FINANCE_TIMEZONE,
  });
  const toMonth = resolveMonthFinancialPeriod({
    referenceDate: to,
    timezone: COMPANY_FINANCE_TIMEZONE,
  });
  const periodLabel = `${fromMonth.from.getTime() === toMonth.from.getTime() ? "Bu Ay" : "Seçili Dönem"}`;

  const defaultPeriod = resolveMonthFinancialPeriod({
    referenceDate: now,
    timezone: COMPANY_FINANCE_TIMEZONE,
  });

  return {
    kpiCards,
    monthlyFinanceData,
    expenseCategories,
    topProducts,
    stockItems,
    lowStockCount,
    trackedStockCount,
    salesCount,
    averageSaleAmount,
    customerReportItems,
    totalCustomers: customers.length,
    summaryItems,
    totalSales: totalSalesAccrual,
    totalIncome,
    totalExpenses,
    netProfit: financeSummary.profit.operational,
    cashNetProfit: financeSummary.profit.cashNet,
    accrualProfit: financeSummary.profit.accrual,
    financeMirrorOutTotal: financeSummary.adjustments.financeMirrorOutTotal,
    metricVersion: financeSummary.metricVersion,
    financeBreakdown: {
      saleCollectionIncome: financeBreakdown.saleCollectionIncome,
      manualIncome: financeBreakdown.manualIncome,
      paidExpenseTotal: financeBreakdown.paidExpenseTotal,
      recordedExpenseTotal: financeBreakdown.recordedExpenseTotal,
      totalAccruedExpense: financeBreakdown.totalAccruedExpense,
      manualCashExpense: financeBreakdown.manualCashExpense,
      saleCancelExpense: financeBreakdown.financeMirrorOutTotal,
      reversalOutTotal: financeBreakdown.reversalOutTotal,
      correctionOutTotal: financeBreakdown.correctionOutTotal,
      financeMirrorOutTotal: financeBreakdown.financeMirrorOutTotal,
      transferInTotal: financeBreakdown.transferInTotal,
      transferOutTotal: financeBreakdown.transferOutTotal,
    },
    accountBalance,
    periodLabel,
    lastUpdatedAt: toIsoString(latestUpdate) ?? new Date().toISOString(),
    reportCards: REPORT_CARDS,
    defaultFrom: defaultPeriod.from.toISOString(),
    defaultTo: defaultPeriod.toInclusive.toISOString(),
  };
}
