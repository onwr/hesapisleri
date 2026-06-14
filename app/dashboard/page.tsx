import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  buildAiInsight,
  buildDailySalesChart,
  endOfLastMonth,
  endOfMonth,
  endOfYesterday,
  formatMoney,
  formatRelativeTime,
  getActivityTag,
  getMonthLabel,
  percentChange,
  startOfDay,
  startOfLastMonth,
  startOfMonth,
  startOfYesterday,
  sumExpensesAmount,
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
import { shouldShowOnboardingAlert } from "@/lib/company-onboarding-utils";
import { buildExpensesQuery } from "@/lib/expenses-page-utils";
import { buildInvoicesQuery } from "@/lib/invoices-page-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { buildSalesQuery, formatDateInputValue } from "@/lib/sales-page-utils";
import { resolveDashboardStatLinks } from "@/lib/dashboard-ui-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export default async function DashboardPage() {
  const token = await getAuthToken();

  if (!token) {
    redirect("/login");
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      companyUsers: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) {
    redirect("/login");
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfYesterday(now);
  const yesterdayEnd = endOfYesterday(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

  const [
    todaySalesRows,
    yesterdaySalesRows,
    monthSalesRows,
    lastMonthSalesRows,
    allExpensesRows,
    unpaidInvoices,
    accounts,
    activityLogs,
    upcomingInvoices,
    accountTransactions,
  ] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId: company.id,
        createdAt: { gte: todayStart },
        ...activeSaleStatusFilter(),
      },
    }),
    db.sale.findMany({
      where: {
        companyId: company.id,
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
        ...activeSaleStatusFilter(),
      },
    }),
    db.sale.findMany({
      where: {
        companyId: company.id,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...activeSaleStatusFilter(),
      },
    }),
    db.sale.findMany({
      where: {
        companyId: company.id,
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
        ...activeSaleStatusFilter(),
      },
    }),
    getCompanyExpensesForFinance(company.id),
    db.invoice.findMany({
      where: {
        companyId: company.id,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        saleId: null,
      },
      include: {
        customer: true,
      },
    }),
    db.account.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    }),
    db.activityLog.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.invoice.findMany({
      where: {
        companyId: company.id,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        saleId: null,
        dueDate: { gte: now },
      },
      include: {
        customer: true,
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    getCompanyAccountTransactions(company.id),
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

  const profit = monthCashIncome - monthExpenses;
  const salesChartData = buildDailySalesChart(monthSalesRows, monthStart);

  const showOnboardingAlert = shouldShowOnboardingAlert(company);

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

  return (
    <AppShell>
      <DashboardContent
        showOnboardingAlert={showOnboardingAlert}
        firstName={user.name.split(" ")[0]}
        monthLabel={getMonthLabel(now)}
        todaySales={todaySales}
        yesterdaySales={yesterdaySales}
        todaySalesChange={percentChange(todaySales, yesterdaySales)}
        monthSales={monthSales}
        lastMonthSales={lastMonthSales}
        monthSalesChange={percentChange(monthSales, lastMonthSales)}
        pendingCollection={pendingCollection}
        dueCollection={dueCollection}
        monthExpenses={monthExpenses}
        totalAccountBalance={totalAccountBalance}
        accountsCount={accounts.length}
        salesChartData={salesChartData}
        incomeExpense={{
          income: monthCashIncome,
          expense: monthExpenses,
          profit,
        }}
        recentActivities={activityLogs.map((log) => {
          const tag = getActivityTag(log.module);

          return {
            id: log.id,
            title: log.message || "Yeni işlem kaydı",
            tag: tag.label,
            tagColor: tag.color,
            time: formatRelativeTime(log.createdAt),
          };
        })}
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          bankName: account.bankName,
          iban: account.iban,
          type: account.type,
          balanceFormatted: formatMoney(Number(account.balance)),
        }))}
        upcomingPayments={upcomingInvoices.map((invoice) => {
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
        })}
        statLinks={statLinks}
        aiInsight={buildAiInsight(
          monthSales,
          lastMonthSales,
          monthExpenses,
          lastMonthFinance.totalExpense,
          pendingCollection
        )}
      />
    </AppShell>
  );
}
