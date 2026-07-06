import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import { db } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth/auth-dal";
import { formatRelativeTime } from "@/lib/dashboard-metrics";
import { getCachedDashboardPageData } from "@/lib/dashboard-cache";
import { resolveDashboardPeriodKey } from "@/lib/dashboard-period-utils";
import { getMembershipAlertForCompany } from "@/lib/membership-service";
import { canManageMembership, canManageSettings } from "@/lib/permission-utils";
import { mapActivityLogToDashboardItem } from "@/lib/activity-log-utils";
import { getDashboardActionNotifications, getNotificationSummary } from "@/lib/notification-service";
import { getDashboardExchangeRates } from "@/lib/exchange-rate-service";
import {
  getDashboardOnboardingChecklist,
  getOrCreateCompanyOnboarding,
  resolveOnboardingRedirectPath,
} from "@/lib/onboarding";

export default async function DashboardPage() {
  const session = await requireCompanyUser();
  const { user, company, companyUser, isSuperAdmin } = session;

  const onboardingState = await getOrCreateCompanyOnboarding(company.id);
  const onboardingRedirect = resolveOnboardingRedirectPath(
    onboardingState,
    isSuperAdmin
  );
  if (onboardingRedirect) {
    redirect(onboardingRedirect);
  }

  const periodKey = resolveDashboardPeriodKey();

  const [dashboardData, activityLogs, actionNotifications, notificationSummary, exchangeRates, onboardingChecklist] =
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
    getDashboardOnboardingChecklist({
      userId: user.id,
      companyId: company.id,
      effectiveRole: session.effectiveRole,
      isOwner: companyUser.isOwner,
      isSuperAdmin,
    }),
  ]);

  const membershipAlert =
    companyUser && canManageMembership(companyUser.role, companyUser.isOwner)
      ? await getMembershipAlertForCompany(company.id, user.id)
      : null;

  return (
    <AppShell>
      <TenantPageSync />
      <DashboardContent
        onboardingChecklist={
          onboardingChecklist.showChecklist
            ? {
                items: onboardingChecklist.items,
                progressPercent: onboardingChecklist.progressPercent,
                canManage: canManageSettings(
                  session.effectiveRole,
                  companyUser.isOwner
                ),
              }
            : null
        }
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
