import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Filter,
  Mail,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import {
  buildMonthlyCashFlowData,
  combineFinanceBreakdown,
  mapAccountTransactions,
  sumActiveAccountBalances,
} from "@/lib/finance-aggregation-utils";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import {
  CashFlowChart,
  ExpenseDonutChart,
  FinanceBarChart,
  ReportMiniLine,
  TopProductsTable,
  type ExpenseCategoryPoint,
  type MonthlyFinancePoint,
} from "@/components/reports/report-charts";
import { formatMoney } from "@/lib/format-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getShortMonth(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
  }).format(date);
}

function getLastSixMonths() {
  const today = new Date();

  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);

    return {
      key: getMonthKey(date),
      label: getShortMonth(date),
    };
  });
}

const reportCards = [
  {
    title: "Gelir - Gider Raporu",
    description: "Kazancınızı görün",
    href: "/reports",
    icon: TrendingUp,
    color: "emerald",
  },
  {
    title: "Nakit Akış Raporu",
    description: "Para giriş çıkışlarınız",
    href: "/reports",
    icon: Wallet,
    color: "blue",
  },
  {
    title: "Satış Raporu",
    description: "Satışlarınızı analiz edin",
    href: "/reports",
    icon: BarChart3,
    color: "orange",
  },
  {
    title: "Ürün Raporu",
    description: "Ürün performansları",
    href: "/reports",
    icon: Package,
    color: "violet",
  },
  {
    title: "Müşteri Raporu",
    description: "Müşteri analizleri",
    href: "/reports",
    icon: Users,
    color: "rose",
  },
  {
    title: "Stok Raporu",
    description: "Stok durum raporu",
    href: "/reports",
    icon: Boxes,
    color: "cyan",
  },
];

const tabs = ["Tüm Raporlar", "Finansal", "Satış", "Stok", "Müşteri"];

export default async function ReportsPage() {
  const token = await getAuthToken();
  if (!token) redirect("/login");

  const payload = verifyToken<AuthPayload>(token);
  if (!payload?.userId || !payload.companyId) redirect("/login");

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

  if (!user) redirect("/login");

  const company =
    user.companyUsers.find((item) => item.companyId === payload.companyId)
      ?.company ?? user.companyUsers[0]?.company;

  if (!company) redirect("/login");

  const now = new Date();
  const periodFrom = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const periodTo = endOfMonth(now);

  const [sales, expenses, invoices, products, customers, accounts, accountTransactionRows] =
    await Promise.all([
      db.sale.findMany({
        where: { companyId: company.id, ...activeSaleStatusFilter() },
        include: {
          customer: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.expense.findMany({
        where: { companyId: company.id },
        orderBy: { date: "desc" },
      }),
      db.invoice.findMany({
        where: { companyId: company.id },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      }),
      db.product.findMany({
        where: { companyId: company.id },
        include: {
          saleItems: true,
        },
      }),
      db.customer.findMany({
        where: { companyId: company.id },
        include: {
          sales: true,
          invoices: true,
        },
      }),
      db.account.findMany({
        where: { companyId: company.id },
      }),
      db.accountTransaction.findMany({
        where: { account: { companyId: company.id } },
        select: {
          id: true,
          date: true,
          createdAt: true,
          title: true,
          note: true,
          amount: true,
          type: true,
        },
      }),
    ]);

  const accountTransactions = mapAccountTransactions(accountTransactionRows);
  const financeBreakdown = combineFinanceBreakdown(
    accountTransactions,
    expenses,
    periodFrom,
    periodTo
  );

  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const totalIncome = financeBreakdown.totalIncome;
  const totalExpenses = financeBreakdown.totalExpense;

  const netProfit = financeBreakdown.netCashFlow;
  const accountBalance = sumActiveAccountBalances(accounts);

  const unpaidInvoiceAmount = invoices
    .filter((invoice) => invoice.paymentStatus !== "PAID")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);

  const stockValue = products.reduce(
    (sum, product) => sum + product.stock * Number(product.sellPrice),
    0
  );

  const customerDebt = customers
    .filter((customer) => Number(customer.balance) > 0)
    .reduce((sum, customer) => sum + Number(customer.balance), 0);

  const customerReceivable = Math.abs(
    customers
      .filter((customer) => Number(customer.balance) < 0)
      .reduce((sum, customer) => sum + Number(customer.balance), 0)
  );

  const months = getLastSixMonths();

  const monthlyFinanceData: MonthlyFinancePoint[] = buildMonthlyCashFlowData(
    accountTransactions,
    expenses,
    periodFrom,
    periodTo
  ).map(({ month, income, expense, net }) => ({
    month,
    income,
    expense,
    net,
  }));

  const expenseCategoryMap = expenses.reduce((map, expense) => {
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

  if (financeBreakdown.saleCancelExpense > 0) {
    expenseCategoryMap.set(
      "Satış İptali",
      (expenseCategoryMap.get("Satış İptali") || 0) +
        financeBreakdown.saleCancelExpense
    );
  }

  const expenseCategories: ExpenseCategoryPoint[] = Array.from(expenseCategoryMap)
    .map(([name, value]) => ({
      name,
      value,
      percent:
        totalExpenses > 0 ? Math.round((value / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topProducts = products
    .map((product) => {
      const soldQty = product.saleItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const revenue = product.saleItems.reduce(
        (sum, item) => sum + Number(item.total),
        0
      );

      return {
        name: product.name,
        soldQty,
        revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const summaryItems = [
    {
      label: "Toplam Alacak",
      value: formatMoney(customerReceivable),
      icon: Wallet,
      color: "emerald",
    },
    {
      label: "Toplam Borç",
      value: formatMoney(customerDebt),
      icon: TrendingDown,
      color: "rose",
    },
    {
      label: "Vadesi Gelen Alacak",
      value: formatMoney(unpaidInvoiceAmount),
      icon: CalendarDays,
      color: "orange",
    },
    {
      label: "Vadesi Gelen Borç",
      value: formatMoney(totalExpenses * 0.4),
      icon: ReceiptText,
      color: "violet",
    },
    {
      label: "Stok Değeri",
      value: formatMoney(stockValue),
      icon: Boxes,
      color: "blue",
    },
  ];

  const reportColorMap = {
    emerald: "from-emerald-50 to-white text-emerald-600",
    blue: "from-blue-50 to-white text-blue-600",
    orange: "from-orange-50 to-white text-orange-500",
    violet: "from-violet-50 to-white text-violet-600",
    rose: "from-rose-50 to-white text-rose-500",
    cyan: "from-cyan-50 to-white text-cyan-600",
  };

  const summaryColorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-500",
    orange: "bg-orange-50 text-orange-500",
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
  };

  const miniLineData = [
    { value: 10 },
    { value: 18 },
    { value: 14 },
    { value: 25 },
    { value: 22 },
    { value: 33 },
    { value: 38 },
  ];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <main className="space-y-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {reportCards.map((card) => {
                const Icon = card.icon;

                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className={[
                      "group rounded-2xl border border-slate-200/80 bg-linear-to-br p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
                      reportColorMap[card.color as keyof typeof reportColorMap],
                    ].join(" ")}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                      <Icon size={23} strokeWidth={2.4} />
                    </div>

                    <p className="mt-4 truncate text-[14px] font-black text-[#0f1f4d]">
                      {card.title}
                    </p>

                    <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                      {card.description}
                    </p>

                    <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-black text-blue-600">
                      Raporu Görüntüle
                      <ArrowRight size={13} strokeWidth={3} />
                    </span>
                  </Link>
                );
              })}
            </section>

            <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
                {tabs.map((tab, index) => (
                  <button
                    key={tab}
                    type="button"
                    className={[
                      "h-10 min-w-[92px] border-r border-slate-100 px-4 text-[12px] font-extrabold transition last:border-r-0",
                      index === 0
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-500 hover:bg-slate-50 hover:text-[#0f1f4d]",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-extrabold text-[#0f1f4d]">
                  <CalendarDays size={16} className="text-slate-500" />
                  <span>13.05.2026</span>
                  <span className="text-slate-400">-</span>
                  <span>13.05.2026</span>
                  <ChevronDown size={15} className="text-slate-400" />
                </div>

                <button
                  type="button"
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-extrabold text-[#0f1f4d] transition hover:bg-slate-50"
                >
                  <Filter size={16} />
                  Filtrele
                  <ChevronDown size={15} className="text-slate-400" />
                </button>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  title: "Toplam Gelir",
                  value: totalIncome,
                  color: "text-emerald-600",
                  line: "#22c55e",
                  previous: `${formatMoney(financeBreakdown.saleCollectionIncome)} tahsilat · ${formatMoney(financeBreakdown.manualIncome)} manuel`,
                  change: "Nakit giriş",
                },
                {
                  title: "Toplam Gider",
                  value: totalExpenses,
                  color: "text-rose-500",
                  line: "#fb7185",
                  previous: "Geçen Dönem: ₺118.900,00",
                  change: "%20",
                },
                {
                  title: "Net Kâr",
                  value: netProfit,
                  color: "text-blue-600",
                  line: "#3b82f6",
                  previous: "Geçen Dönem: ₺70.600,00",
                  change: "%32",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-[12px] font-extrabold text-[#24345f]/80">
                    {item.title}
                  </p>

                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div>
                      <p
                        className={[
                          "text-[22px] font-black tracking-[-0.04em]",
                          item.color,
                        ].join(" ")}
                      >
                        {formatMoney(item.value)}
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {item.previous}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600">
                          ↑ {item.change}
                        </span>
                      </div>
                    </div>

                    <ReportMiniLine data={miniLineData} color={item.line} />
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-black text-[#0f1f4d]">
                      Gelir - Gider Dağılımı
                    </h3>
                    <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Gelir
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        Gider
                      </span>
                    </div>
                  </div>

                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#0f1f4d]">
                    Aylık
                  </button>
                </div>

                <FinanceBarChart data={monthlyFinanceData} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-black text-[#0f1f4d]">
                      Nakit Akış Özeti
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Nakit Girişi
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-400" />
                        Nakit Çıkışı
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                        Net Nakit
                      </span>
                    </div>
                  </div>

                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#0f1f4d]">
                    Aylık
                  </button>
                </div>

                <CashFlowChart data={monthlyFinanceData} />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    Gider Kategorileri
                  </h3>

                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#0f1f4d]">
                    Bu Ay
                  </button>
                </div>

                <ExpenseDonutChart data={expenseCategories} total={totalExpenses} />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    En Çok Satan Ürünler
                  </h3>

                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#0f1f4d]">
                    Bu Ay
                  </button>
                </div>

                <TopProductsTable data={topProducts} />
              </div>
            </section>

            <p className="text-center text-[11px] font-semibold text-slate-400">
              Son güncelleme: 13.05.2026 21:45
            </p>
          </main>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Özet Bilgiler
              </h3>

              <div className="space-y-4">
                {summaryItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                          summaryColorMap[
                            item.color as keyof typeof summaryColorMap
                          ],
                        ].join(" ")}
                      >
                        <Icon size={15} strokeWidth={2.5} />
                      </div>

                      <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#24345f]">
                        {item.label}
                      </p>

                      <p
                        className={[
                          "shrink-0 text-[11px] font-black",
                          item.color === "rose"
                            ? "text-rose-500"
                            : item.color === "orange"
                              ? "text-orange-500"
                              : item.color === "blue"
                                ? "text-blue-600"
                                : "text-emerald-600",
                        ].join(" ")}
                      >
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Son Oluşturulan Raporlar
              </h3>

              <div className="space-y-3">
                {reportCards.slice(0, 5).map((report) => {
                  const Icon = report.icon;

                  return (
                    <div key={report.title} className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br",
                          reportColorMap[
                            report.color as keyof typeof reportColorMap
                          ],
                        ].join(" ")}
                      >
                        <Icon size={16} strokeWidth={2.4} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-black text-[#0f1f4d]">
                          {report.title}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          13.05.2026 21:30
                        </p>
                      </div>

                      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#24345f] hover:bg-slate-50">
                        <Download size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <Link
                href="/reports"
                className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white text-[12px] font-black text-violet-600 shadow-sm"
              >
                Tüm Raporları Görüntüle
                <ArrowRight size={14} strokeWidth={3} />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Kısayollar
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Rapor Oluştur",
                    icon: FileText,
                    color: "bg-emerald-50 text-emerald-600",
                  },
                  {
                    label: "Excel İndir",
                    icon: Download,
                    color: "bg-rose-50 text-rose-500",
                  },
                  {
                    label: "PDF İndir",
                    icon: ReceiptText,
                    color: "bg-orange-50 text-orange-500",
                  },
                  {
                    label: "E-posta Gönder",
                    icon: Mail,
                    color: "bg-blue-50 text-blue-600",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="group flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-center transition hover:bg-slate-100"
                    >
                      <span
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          item.color,
                        ].join(" ")}
                      >
                        <Icon size={18} strokeWidth={2.5} />
                      </span>

                      <span className="text-[11px] font-black text-[#24345f]">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}