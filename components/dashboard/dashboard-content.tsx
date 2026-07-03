"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Box,
  Building2,
  CalendarClock,
  Clock3,
  FileText,
  Lightbulb,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import { DashboardIncomeChart } from "@/components/dashboard/dashboard-income-chart";
import { DashboardExchangeRates } from "@/components/dashboard/dashboard-exchange-rates";
import { DashboardShortcutsPanel } from "@/components/dashboard/dashboard-shortcuts-panel";
import {
  DashboardNotificationsPanel,
  type DashboardNotificationItem,
} from "@/components/dashboard/dashboard-notifications-panel";
import { DashboardStartChecklist } from "@/components/dashboard/dashboard-start-checklist";
import { DashboardMembershipAlert } from "@/components/dashboard/dashboard-membership-alert";
import { DashboardSalesChart } from "@/components/dashboard/dashboard-sales-chart";
import {
  dashboardFadeUp,
  dashboardStagger,
  gridStagger,
  listStagger,
} from "@/components/dashboard/dashboard-motion";
import { AiPageTriggerButton } from "@/components/ai-assistant/ai-page-trigger-button";
import { formatMoney } from "@/lib/dashboard-metrics";
import type { ExchangeRateDisplay } from "@/lib/exchange-rate-utils";
import type { OnboardingChecklistItem } from "@/lib/onboarding/onboarding-progress";

import {
  resolveDashboardStatLinks,
  type DashboardStatLinks,
} from "@/lib/dashboard-ui-utils";

type DashboardOnboardingChecklistProps = {
  items: OnboardingChecklistItem[];
  progressPercent: number;
  canManage: boolean;
};

type ActivityTagColor = "green" | "blue" | "orange" | "purple" | "slate";

export type DashboardContentProps = {
  onboardingChecklist?: DashboardOnboardingChecklistProps | null;
  membershipAlert?: {
    type: "expired" | "expiring";
    message: string;
    actionUrl: string;
  } | null;
  firstName: string;
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
  recentActivities: Array<{
    id: string;
    title: string;
    description: string | null;
    amountLabel: string | null;
    tag: string;
    tagColor: ActivityTagColor;
    time: string;
    href?: string | null;
  }>;
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
  statLinks?: DashboardStatLinks;
  actionNotifications: DashboardNotificationItem[];
  notificationSummary: {
    unread: number;
    critical: number;
    high: number;
  };
  exchangeRates: ExchangeRateDisplay | null;
  userId: string;
  companyId: string;
};

const tagColorMap: Record<ActivityTagColor, string> = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-violet-100 text-violet-800",
  slate: "bg-slate-100 text-slate-700",
};

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

const listRowClassName =
  "flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 transition hover:bg-slate-50";

const emptyStateClassName =
  "rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[14px] font-medium text-slate-500";

export function DashboardContent({
  onboardingChecklist = null,
  membershipAlert = null,
  firstName,
  monthLabel,
  todaySales,
  todaySalesChange,
  monthSales,
  monthSalesChange,
  pendingCollection,
  dueCollection,
  monthExpenses,
  totalAccountBalance,
  accountsCount,
  salesChartData,
  incomeExpense,
  recentActivities,
  accounts,
  upcomingPayments,
  statLinks,
  actionNotifications,
  notificationSummary,
  exchangeRates,
  userId,
  companyId,
}: DashboardContentProps) {
  const links = resolveDashboardStatLinks(statLinks);
  const hasSalesChartData = salesChartData.some((point) => point.amount > 0);
  const hasIncomeChartData =
    incomeExpense.income > 0 || incomeExpense.expense > 0;
  const showCompactCharts = !hasSalesChartData && !hasIncomeChartData;
  const showNotificationsPanel =
    actionNotifications.length > 0 ||
    notificationSummary.unread > 0 ||
    notificationSummary.critical > 0;

  function getBankLogo(accountName: string) {
    const name = accountName.toLocaleLowerCase("tr-TR");

    if (
      name.includes("iş") ||
      name.includes("is bankasi") ||
      name.includes("iş bankası")
    ) {
      return "/isbankasi.jpg";
    }

    if (name.includes("garanti") || name.includes("bbva")) {
      return "/garantibbva.jpg";
    }

    if (name.includes("vakıf") || name.includes("vakif")) {
      return "/vakifbank.webp";
    }

    return null;
  }

  return (
    <motion.div
      className="space-y-4 max-md:min-w-0"
      variants={dashboardStagger}
      initial="hidden"
      animate="visible"
    >
      {membershipAlert ? (
        <DashboardMembershipAlert
          type={membershipAlert.type}
          message={membershipAlert.message}
          actionUrl={membershipAlert.actionUrl}
        />
      ) : null}

      {onboardingChecklist ? (
        <DashboardStartChecklist
          items={onboardingChecklist.items}
          progressPercent={onboardingChecklist.progressPercent}
          canManage={onboardingChecklist.canManage}
        />
      ) : null}

      <motion.div variants={dashboardFadeUp} className="flex justify-end">
        <AiPageTriggerButton moduleKey="dashboard" />
      </motion.div>

      <motion.section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        variants={dashboardFadeUp}
      >
        {[
          {
            title: "Yeni Satış",
            description: "Hemen satış oluştur",
            href: "/sales/new",
            iconName: "shopping-cart" as const,
            gradient: "bg-linear-to-br from-emerald-500 to-green-600",
          },
          {
            title: "Fatura Kes",
            description: "Yeni fatura oluştur",
            href: "/invoices/e-invoice",
            iconName: "file-text" as const,
            gradient: "bg-linear-to-br from-violet-500 to-purple-600",
          },
          {
            title: "Gider Ekle",
            description: "Gider kaydı oluştur",
            href: "/expenses/new",
            iconName: "receipt-text" as const,
            gradient: "bg-linear-to-br from-orange-400 to-orange-600",
          },
          {
            title: "Tahsilat Al",
            description: "Müşteriden ödeme al",
            href: "/cash-bank/collections",
            iconName: "wallet" as const,
            gradient: "bg-linear-to-br from-sky-400 to-blue-600",
          },
          {
            title: "Ürün Ekle",
            description: "Yeni ürün ekle",
            href: "/products/new",
            iconName: "package" as const,
            gradient: "bg-linear-to-br from-rose-400 to-pink-600",
          },
        ].map((card) => (
          <motion.div key={card.href} variants={dashboardFadeUp}>
            <ActionCard {...card} />
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        variants={gridStagger}
      >
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Bugünkü Satış"
            value={formatMoney(todaySales)}
            comparisonLabel="Düne göre"
            changePercent={todaySalesChange}
            icon={<TrendingUp size={20} />}
            color="green"
            href={links.todaySales}
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Bu Ay Toplam Satış"
            value={formatMoney(monthSales)}
            comparisonLabel="Geçen aya göre"
            changePercent={monthSalesChange}
            icon={<ShoppingCart size={20} />}
            color="blue"
            href={links.monthSales}
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Tahsilat Bekleyen"
            value={formatMoney(pendingCollection)}
            highlight={
              dueCollection > 0
                ? `Vadesi gelen: ${formatMoney(dueCollection)}`
                : undefined
            }
            subtitle={dueCollection === 0 ? "Vadesi gelen yok" : undefined}
            icon={<CalendarClock size={20} />}
            color="orange"
            href={links.pendingCollection}
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Toplam Gider"
            value={formatMoney(monthExpenses)}
            subtitle="Bu ay"
            icon={<ReceiptText size={20} />}
            color="red"
            href={links.monthExpenses}
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Kasa & Banka"
            value={formatMoney(totalAccountBalance)}
            subtitle={`${accountsCount} hesap`}
            icon={<Banknote size={20} />}
            color="purple"
            href={links.cashBank}
          />
        </motion.div>
      </motion.section>

      <div className="grid gap-4 max-md:min-w-0 xl:grid-cols-[1fr_280px] 2xl:grid-cols-[1fr_300px]">
        <motion.div className="space-y-4" variants={dashboardStagger}>
          <motion.div
            className={[
              "grid gap-4 max-md:min-w-0",
              showCompactCharts ? "lg:grid-cols-2" : "lg:grid-cols-[1.08fr_0.92fr]",
            ].join(" ")}
            variants={dashboardFadeUp}
          >
            <DashboardSalesChart
              data={salesChartData}
              monthLabel={monthLabel}
              compact={showCompactCharts}
            />
            <DashboardIncomeChart
              data={incomeExpense}
              compact={showCompactCharts}
            />
          </motion.div>

          <motion.div
            className="grid gap-4 lg:grid-cols-2"
            variants={dashboardFadeUp}
          >
            <motion.div variants={dashboardFadeUp} className={cardClassName}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                  Son İşlemler
                </h3>

                <Link
                  href="/sales"
                  className="inline-flex items-center gap-1 text-[13px] font-extrabold text-blue-600 transition hover:text-blue-700"
                >
                  Tümünü Gör
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="space-y-3 md:hidden">
                {recentActivities.length === 0 ? (
                  <div className={emptyStateClassName}>
                    <p className="text-[14px] font-extrabold text-[#0f1f4d]">
                      Henüz işlem yok
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-slate-500">
                      Satış, gider, ürün veya stok işlemleri yaptıkça burada görünecek.
                    </p>
                  </div>
                ) : (
                  recentActivities.slice(0, 4).map((activity) => {
                    const card = (
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="truncate text-[13px] font-extrabold text-[#0f1f4d]"
                              title={activity.title}
                            >
                              {activity.title}
                            </p>
                            {activity.description ? (
                              <p
                                className="mt-1 truncate text-[13px] font-medium text-slate-600"
                                title={activity.description}
                              >
                                {activity.description}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-1 text-[13px] font-extrabold ${tagColorMap[activity.tagColor]}`}
                              >
                                {activity.tag}
                              </span>
                              <span className="text-[13px] font-medium text-slate-500">
                                {activity.time}
                              </span>
                            </div>
                          </div>

                          {activity.amountLabel ? (
                            <span className="shrink-0 whitespace-nowrap text-[13px] font-extrabold text-[#0f1f4d]">
                              {activity.amountLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );

                    return activity.href ? (
                      <Link key={activity.id} href={activity.href} className="block">
                        {card}
                      </Link>
                    ) : (
                      <div key={activity.id}>{card}</div>
                    );
                  })
                )}
              </div>

              <motion.div className="hidden space-y-3 md:block" variants={listStagger}>
                {recentActivities.length === 0 ? (
                  <div className={emptyStateClassName}>
                    <p className="text-[14px] font-extrabold text-[#0f1f4d]">
                      Henüz işlem yok
                    </p>
                    <p className="mt-1 text-[13px] font-medium text-slate-500">
                      Satış, gider, ürün veya stok işlemleri yaptıkça burada görünecek.
                    </p>
                  </div>
                ) : (
                  recentActivities.slice(0, 4).map((activity, index) => {
                    const activityIconStyles = [
                      "bg-emerald-50 text-emerald-500",
                      "bg-violet-50 text-violet-500",
                      "bg-sky-50 text-sky-500",
                      "bg-rose-50 text-rose-500",
                    ];

                    const ActivityIcon =
                      activity.tagColor === "green"
                        ? ShoppingCart
                        : activity.tagColor === "purple"
                          ? FileText
                          : activity.tagColor === "blue"
                            ? Wallet
                            : ReceiptText;

                    const rowContent = (
                      <>
                        <div
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-full",
                            activityIconStyles[index % activityIconStyles.length],
                          ].join(" ")}
                        >
                          <ActivityIcon size={17} strokeWidth={2.4} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-extrabold leading-4 text-[#0f1f4d]">
                            {activity.title}
                          </p>

                          {activity.description ? (
                            <p className="mt-0.5 truncate text-[13px] font-medium leading-4 text-slate-600">
                              {activity.description}
                            </p>
                          ) : null}
                        </div>

                        <span
                          className={`justify-self-center rounded-md px-2 py-1 text-[13px] font-extrabold leading-none ${tagColorMap[activity.tagColor]}`}
                        >
                          {activity.tag}
                        </span>

                        <div className="min-w-[92px] text-right">
                          {activity.amountLabel ? (
                            <p className="text-[13px] font-extrabold tracking-[-0.01em] text-[#0f1f4d]">
                              {activity.amountLabel}
                            </p>
                          ) : null}

                          <p
                            className={[
                              "text-[13px] font-medium text-slate-500",
                              activity.amountLabel ? "mt-0.5" : "",
                            ].join(" ")}
                          >
                            {activity.time}
                          </p>
                        </div>
                      </>
                    );

                    return activity.href ? (
                      <Link
                        key={activity.id}
                        href={activity.href}
                        className="grid grid-cols-[34px_1fr_auto_auto] items-center gap-3 rounded-2xl transition hover:bg-slate-50"
                      >
                        {rowContent}
                      </Link>
                    ) : (
                      <motion.div
                        key={activity.id}
                        variants={dashboardFadeUp}
                        className="grid grid-cols-[34px_1fr_auto_auto] items-center gap-3 rounded-2xl transition hover:bg-slate-50"
                      >
                        {rowContent}
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </motion.div>

            <motion.div variants={dashboardFadeUp} className={cardClassName}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                  Banka Hesapları
                </h3>

                <Link
                  href="/cash-bank"
                  className="inline-flex items-center gap-1 text-[13px] font-extrabold text-blue-600 transition hover:text-blue-700"
                >
                  Tümünü Gör
                  <ArrowRight size={14} />
                </Link>
              </div>

              <motion.div className="space-y-4" variants={listStagger}>
                {accounts.length === 0 ? (
                  <p className={emptyStateClassName}>Henüz kayıt bulunmuyor</p>
                ) : (
                  accounts.slice(0, 3).map((account) => {
                    const displayName = account.bankName || account.name;
                    const bankLogo = getBankLogo(displayName);

                    return (
                      <Link
                        key={account.id}
                        href={`/cash-bank/${account.id}`}
                        className="flex items-center justify-between gap-4 rounded-2xl transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                            {bankLogo ? (
                              <Image
                                src={bankLogo}
                                alt={displayName}
                                width={44}
                                height={44}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Building2
                                size={19}
                                strokeWidth={2.3}
                                className="text-blue-600"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-extrabold leading-4 text-[#0f1f4d]">
                              {displayName}
                            </p>

                            <p className="mt-1 truncate text-[13px] font-medium leading-4 text-slate-600">
                              {account.type === "CASH"
                                ? "CASH"
                                : account.iban
                                  ? account.iban
                                  : account.type}
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-[14px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                          {account.balanceFormatted}
                        </p>
                      </Link>
                    );
                  })
                )}
              </motion.div>
            </motion.div>
          </motion.div>

          {showNotificationsPanel ? (
            <motion.div variants={dashboardFadeUp}>
              <DashboardNotificationsPanel
                items={actionNotifications}
                summary={notificationSummary}
              />
            </motion.div>
          ) : null}
        </motion.div>

        <motion.div className="space-y-4" variants={dashboardStagger}>
          {/* Yaklaşan Ödemeler */}
          <motion.div
            variants={dashboardFadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-extrabold text-[#0f1f4d]">
                Yaklaşan Ödemeler
              </h3>

              <Link
                href={links.pendingCollection}
                className="text-[13px] font-bold text-blue-700 hover:text-blue-800"
              >
                Tümünü Gör
              </Link>
            </div>

            <motion.div className="space-y-4" variants={listStagger}>
              {upcomingPayments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Henüz kayıt bulunmuyor
                </p>
              ) : (
                upcomingPayments.slice(0, 3).map((payment, index) => {
                  const iconStyles = [
                    "bg-blue-50 text-blue-500",
                    "bg-orange-50 text-orange-500",
                    "bg-violet-50 text-violet-500",
                  ];

                  const badgeStyles =
                    payment.daysLeft <= 2
                      ? "bg-rose-50 text-rose-500"
                      : payment.daysLeft <= 4
                        ? "bg-orange-50 text-orange-500"
                        : "bg-amber-50 text-amber-500";

                  return (
                    <Link
                      key={payment.id}
                      href={payment.href || `/invoices/${payment.id}`}
                      className="flex items-start gap-3 rounded-xl p-1 transition hover:bg-slate-50"
                    >
                      <div
                        className={[
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          iconStyles[index % iconStyles.length],
                        ].join(" ")}
                      >
                        <Clock3 size={17} strokeWidth={2.3} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-extrabold text-[#0f1f4d]">
                          {payment.title}
                        </p>

                        <p className="mt-1 text-[13px] font-medium text-slate-600">
                          Vade: {payment.dueDateFormatted}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-extrabold text-rose-600">
                          {payment.amountFormatted}
                        </p>

                        <span
                          className={[
                            "mt-1 inline-flex rounded-full px-2 py-1 text-[13px] font-bold leading-none",
                            badgeStyles,
                          ].join(" ")}
                        >
                          {payment.daysLeft === 0
                            ? "Bugün"
                            : `${payment.daysLeft} gün kaldı`}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </motion.div>
          </motion.div>


          {/* Kısayollarım */}
          <motion.div variants={dashboardFadeUp}>
            <DashboardShortcutsPanel userId={userId} companyId={companyId} />
          </motion.div>

          <motion.div variants={dashboardFadeUp}>
            <DashboardExchangeRates data={exchangeRates} />
          </motion.div>
        </motion.div>
      </div>

      {!onboardingChecklist ? (
        <motion.section variants={dashboardFadeUp}>
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm leading-6 text-amber-950/90">
              İpucu: Hızlı işlem kartlarından satış, fatura ve tahsilat
              işlemlerinizi tek tıkla başlatabilirsiniz. POS ekranından anlık
              satış yaparak stok ve kasa hareketlerinizi otomatik güncelleyin.
            </p>
          </div>
        </motion.section>
      ) : null}
    </motion.div>
  );
}
