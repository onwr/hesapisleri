import { AppShell } from "@/components/layout/app-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { db } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth/auth-dal";
import { formatRelativeTime } from "@/lib/dashboard-metrics";
import { getCachedDashboardPageData } from "@/lib/dashboard-cache";
import { resolveDashboardAiInsights } from "@/lib/dashboard-page-data";
import { resolveDashboardPeriodKey } from "@/lib/dashboard-period-utils";
import { shouldShowOnboardingAlert } from "@/lib/company-onboarding-utils";
import { getMembershipAlertForCompany } from "@/lib/membership-service";
import { canManageMembership } from "@/lib/permission-utils";
import { mapActivityLogToDashboardItem } from "@/lib/activity-log-utils";
import { getDashboardActionNotifications, getNotificationSummary } from "@/lib/notification-service";
import { getDashboardExchangeRates } from "@/lib/exchange-rate-service";

export default async function DashboardPage() {
  const session = await requireCompanyUser();
  const { user, company, companyUser } = session;

  const periodKey = resolveDashboardPeriodKey();

  const [dashboardData, activityLogs, actionNotifications, notificationSummary, exchangeRates] =
    await Promise.all([
    getCachedDashboardPageData({
      companyId: company.id,
      periodKey,
    }),
    db.activityLog.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        action: true,
        module: true,
        message: true,
        createdAt: true,
      },
    }),
    getDashboardActionNotifications({
      companyId: company.id,
      userId: user.id,
      limit: 8,
    }),
    getNotificationSummary({
      companyId: company.id,
      userId: user.id,
    }),
    getDashboardExchangeRates(),
  ]);

  const showOnboardingAlert = shouldShowOnboardingAlert(company);

  const membershipAlert =
    companyUser && canManageMembership(companyUser.role, companyUser.isOwner)
      ? await getMembershipAlertForCompany(company.id)
      : null;

  return (
    <AppShell>
      <DashboardContent
        showOnboardingAlert={showOnboardingAlert}
        membershipAlert={membershipAlert}
        firstName={user.name.split(" ")[0]}
        monthLabel={dashboardData.monthLabel}
        todaySales={dashboardData.todaySales}
        yesterdaySales={dashboardData.yesterdaySales}
        todaySalesChange={dashboardData.todaySalesChange}
        monthSales={dashboardData.monthSales}
        lastMonthSales={dashboardData.lastMonthSales}
        monthSalesChange={dashboardData.monthSalesChange}
        pendingCollection={dashboardData.pendingCollection}
        dueCollection={dashboardData.dueCollection}
        monthExpenses={dashboardData.monthExpenses}
        totalAccountBalance={dashboardData.totalAccountBalance}
        accountsCount={dashboardData.accountsCount}
        salesChartData={dashboardData.salesChartData}
        incomeExpense={dashboardData.incomeExpense}
        recentActivities={activityLogs
          .map((log) =>
            mapActivityLogToDashboardItem(log, formatRelativeTime)
          )
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .slice(0, 8)}
        accounts={dashboardData.accounts}
        upcomingPayments={dashboardData.upcomingPayments}
        statLinks={dashboardData.statLinks}
        aiInsights={resolveDashboardAiInsights(dashboardData)}
        actionNotifications={actionNotifications}
        notificationSummary={{
          unread: notificationSummary.unread,
          critical: notificationSummary.critical,
          high: notificationSummary.high,
        }}
        exchangeRates={exchangeRates}
        userId={user.id}
        companyId={company.id}
      />
    </AppShell>
  );
}
