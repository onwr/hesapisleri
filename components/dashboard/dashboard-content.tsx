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
  CreditCard,
  FileText,
  Lightbulb,
  Package,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { ActionCard } from "@/components/cards/action-card";
import { StatCard } from "@/components/cards/stat-card";
import { DashboardIncomeChart } from "@/components/dashboard/dashboard-income-chart";
import { DashboardOnboardingAlert } from "@/components/dashboard/dashboard-onboarding-alert";
import { DashboardSalesChart } from "@/components/dashboard/dashboard-sales-chart";
import {
  dashboardFadeUp,
  dashboardStagger,
  gridStagger,
  listStagger,
} from "@/components/dashboard/dashboard-motion";
import { formatMoney } from "@/lib/dashboard-metrics";

type ActivityTagColor = "green" | "blue" | "orange" | "purple" | "slate";

export type DashboardContentProps = {
  showOnboardingAlert: boolean;
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
    tag: string;
    tagColor: ActivityTagColor;
    time: string;
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
  }>;
  aiInsight: string;
};

const tagColorMap: Record<ActivityTagColor, string> = {
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-violet-100 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
};

const cardClassName =
  "rounded-[22px] border border-slate-200/70 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.035)]";

const listRowClassName =
  "flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 transition hover:bg-slate-50";

const emptyStateClassName =
  "rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] font-medium text-slate-500";

const shortcuts = [
  { label: "Yeni Müşteri", href: "/customers/new", icon: Users },
  { label: "Ürün Listesi", href: "/products", icon: Package },
  { label: "Fatura Listesi", href: "/invoices", icon: FileText },
  { label: "Stok Durumu", href: "/stocks", icon: Box },
  { label: "Cari Hesaplar", href: "/customers", icon: CreditCard },
  { label: "Kasa Hareketleri", href: "/cash-bank", icon: TrendingUp },
];

export function DashboardContent({
  showOnboardingAlert,
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
  aiInsight,
}: DashboardContentProps) {
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
      className="space-y-4"
      variants={dashboardStagger}
      initial="hidden"
      animate="visible"
    >
      {showOnboardingAlert ? <DashboardOnboardingAlert /> : null}

      <motion.section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        variants={dashboardFadeUp}
      >
        {[
          {
            title: "Yeni Satış",
            description: "Hemen satış oluştur",
            href: "/sales/new",
            icon: <ShoppingCart size={22} />,
            gradient: "bg-linear-to-br from-emerald-500 to-green-600",
          },
          {
            title: "Fatura Kes",
            description: "Yeni fatura oluştur",
            href: "/invoices/e-invoice",
            icon: <FileText size={22} />,
            gradient: "bg-linear-to-br from-violet-500 to-purple-600",
          },
          {
            title: "Gider Ekle",
            description: "Gider kaydı oluştur",
            href: "/expenses/new",
            icon: <ReceiptText size={22} />,
            gradient: "bg-linear-to-br from-orange-400 to-orange-600",
          },
          {
            title: "Tahsilat Al",
            description: "Müşteriden ödeme al",
            href: "/cash-bank",
            icon: <Wallet size={22} />,
            gradient: "bg-linear-to-br from-sky-400 to-blue-600",
          },
          {
            title: "Ürün Ekle",
            description: "Yeni ürün ekle",
            href: "/products/new",
            icon: <Box size={22} />,
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
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Toplam Gider"
            value={formatMoney(monthExpenses)}
            subtitle="Bu ay"
            icon={<ReceiptText size={20} />}
            color="red"
          />
        </motion.div>
        <motion.div variants={dashboardFadeUp}>
          <StatCard
            title="Kasa & Banka"
            value={formatMoney(totalAccountBalance)}
            subtitle={`${accountsCount} hesap`}
            icon={<Banknote size={20} />}
            color="purple"
          />
        </motion.div>
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px] 2xl:grid-cols-[1fr_300px]">
        <motion.div className="space-y-4" variants={dashboardStagger}>
          <motion.div
            className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]"
            variants={dashboardFadeUp}
          >
            <DashboardSalesChart data={salesChartData} monthLabel={monthLabel} />
            <DashboardIncomeChart data={incomeExpense} />
          </motion.div>

          <motion.div
            className="grid gap-4 lg:grid-cols-2"
            variants={dashboardFadeUp}
          >
            <motion.div variants={dashboardFadeUp} className={cardClassName}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                  Son İşlemler
                </h3>

                <Link
                  href="/sales"
                  className="inline-flex items-center gap-1 text-[12px] font-extrabold text-blue-600 transition hover:text-blue-700"
                >
                  Tümünü Gör
                  <ArrowRight size={14} />
                </Link>
              </div>

              <motion.div className="space-y-3" variants={listStagger}>
                {recentActivities.length === 0 ? (
                  <p className={emptyStateClassName}>Henüz kayıt bulunmuyor</p>
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

                    return (
                      <motion.div
                        key={activity.id}
                        variants={dashboardFadeUp}
                        className="grid grid-cols-[34px_1fr_auto_auto] items-center gap-3 rounded-2xl transition hover:bg-slate-50"
                      >
                        <div
                          className={[
                            "flex h-9 w-9 items-center justify-center rounded-full",
                            activityIconStyles[index % activityIconStyles.length],
                          ].join(" ")}
                        >
                          <ActivityIcon size={17} strokeWidth={2.4} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-extrabold leading-4 text-[#0f1f4d]">
                            {activity.title}
                          </p>

                          <p className="mt-0.5 truncate text-[10.5px] font-medium leading-4 text-slate-500">
                            {activity.tag === "Satış"
                              ? "Müşteri: Mehmet Kaya"
                              : activity.tag === "Fatura"
                                ? "Fatura No: FTR-2026-00035"
                                : activity.tag === "Tahsilat"
                                  ? "Müşteri: ABC Ltd. Şti."
                                  : "Açıklama: Kırtasiye Alımı"}
                          </p>
                        </div>

                        <span
                          className={`justify-self-center rounded-md px-2 py-1 text-[10px] font-extrabold leading-none ${tagColorMap[activity.tagColor]}`}
                        >
                          {activity.tag}
                        </span>

                        <div className="min-w-[92px] text-right">
                          <p className="text-[12px] font-extrabold tracking-[-0.01em] text-[#0f1f4d]">
                            {activity.tag === "Satış"
                              ? "₺3.250,00"
                              : activity.tag === "Fatura"
                                ? "₺7.800,00"
                                : activity.tag === "Tahsilat"
                                  ? "₺5.000,00"
                                  : "₺350,00"}
                          </p>

                          <p className="mt-0.5 text-[10.5px] font-medium text-slate-400">
                            {activity.time}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </motion.div>

            <motion.div variants={dashboardFadeUp} className={cardClassName}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                  Banka Hesapları
                </h3>

                <Link
                  href="/cash-bank"
                  className="inline-flex items-center gap-1 text-[12px] font-extrabold text-blue-600 transition hover:text-blue-700"
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
                      <motion.div
                        key={account.id}
                        variants={dashboardFadeUp}
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
                            <p className="truncate text-[12.5px] font-extrabold leading-4 text-[#0f1f4d]">
                              {displayName}
                            </p>

                            <p className="mt-1 truncate text-[10.5px] font-medium leading-4 text-slate-500">
                              {account.type === "CASH"
                                ? "CASH"
                                : account.iban
                                  ? account.iban
                                  : account.type}
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-[13px] font-extrabold tracking-[-0.02em] text-[#0f1f4d]">
                          {account.balanceFormatted}
                        </p>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div className="space-y-4" variants={dashboardStagger}>
          {/* Yaklaşan Ödemeler */}
          <motion.div
            variants={dashboardFadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
                Yaklaşan Ödemeler
              </h3>

              <Link
                href="/invoices"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
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
                    <motion.div
                      key={payment.id}
                      variants={dashboardFadeUp}
                      className="flex items-start gap-3"
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
                        <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                          {payment.title}
                        </p>

                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          Vade: {payment.dueDateFormatted}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[12px] font-extrabold text-rose-500">
                          {payment.amountFormatted}
                        </p>

                        <span
                          className={[
                            "mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold leading-none",
                            badgeStyles,
                          ].join(" ")}
                        >
                          {payment.daysLeft === 0
                            ? "Bugün"
                            : `${payment.daysLeft} gün kaldı`}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </motion.div>

          {/* Akıllı Asistan */}
          <motion.div
            variants={dashboardFadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <Image
                src="/robot.png"
                alt="Akıllı Asistan"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 object-contain"
              />

              <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
                Akıllı Asistan
              </h3>
            </div>

            <div className="rounded-2xl bg-linear-to-br from-blue-50 via-slate-50 to-violet-50 p-4">
              <p className="text-[12px] font-medium leading-5 text-[#24345f]">
                {aiInsight}
              </p>
            </div>

            <Link
              href="/ai-assistant"
              className="mt-3 inline-flex h-8 items-center justify-center rounded-lg border border-blue-100 bg-white px-4 text-[11px] font-bold text-blue-600 shadow-sm transition hover:bg-blue-50"
            >
              Detayları Gör
            </Link>

            <div className="mt-4 flex items-center justify-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0f1f4d]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            </div>
          </motion.div>

          {/* Kısayollarım */}
          <motion.div
            variants={dashboardFadeUp}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold text-[#0f1f4d]">
                Kısayollarım
              </h3>

              <button
                type="button"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                Düzenle
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {shortcuts.slice(0, 6).map((item, index) => {
                const Icon = item.icon;

                const shortcutStyles = [
                  "bg-violet-50 text-violet-600",
                  "bg-orange-50 text-orange-500",
                  "bg-blue-50 text-blue-500",
                  "bg-purple-50 text-purple-500",
                  "bg-amber-50 text-amber-500",
                  "bg-emerald-50 text-emerald-600",
                ];

                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="group flex flex-col items-center gap-2 text-center"
                  >
                    <div
                      className={[
                        "flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105",
                        shortcutStyles[index % shortcutStyles.length],
                      ].join(" ")}
                    >
                      <Icon size={21} strokeWidth={2.4} />
                    </div>

                    <span className="line-clamp-1 text-[10px] font-bold text-[#24345f]">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>

      <motion.section variants={dashboardFadeUp}>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-sm leading-6 text-amber-900/80">
            İpucu: Hızlı işlem kartlarından satış, fatura ve tahsilat
            işlemlerinizi tek tıkla başlatabilirsiniz. POS ekranından anlık
            satış yaparak stok ve kasa hareketlerinizi otomatik güncelleyin.
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}
