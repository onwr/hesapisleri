import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  Download,
  Mail,
  Package,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";

import {
  CashFlowChart,
  ExpenseDonutChart,
  FinanceBarChart,
  ReportMiniLine,
  StockReportTable,
  TopProductsTable,
} from "@/components/reports/report-charts";
import { ReportsPageControls } from "@/components/reports/reports-page-controls";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { formatNumber } from "@/lib/format-utils";
import { getReportsPageData } from "@/lib/reports-page-data";
import {
  buildReportCardHref,
  buildReportsExportQuery,
  buildReportsQuery,
  filterReportCards,
  formatReportDateTime,
  formatReportMoney,
  getReportCardByKey,
  normalizeDateRange,
  parseDateParam,
  parseReportTab,
  parseReportView,
  resolveReportSections,
  type ReportCardItem,
} from "@/lib/reports-page-utils";

type ReportsPageProps = {
  searchParams: Promise<{
    tab?: string;
    report?: string;
    from?: string;
    to?: string;
  }>;
};

const reportIconMap = {
  trendingUp: TrendingUp,
  wallet: Wallet,
  barChart: BarChart3,
  package: Package,
  users: Users,
  boxes: Boxes,
};

const summaryIconMap = {
  wallet: Wallet,
  trendingDown: TrendingDown,
  calendar: CalendarDays,
  receipt: ReceiptText,
  boxes: Boxes,
};

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

const kpiColorMap = {
  emerald: "text-emerald-600",
  rose: "text-rose-500",
  blue: "text-blue-600",
};

function ReportCardLink({
  card,
  from,
  to,
  isActive,
}: {
  card: ReportCardItem;
  from: Date;
  to: Date;
  isActive: boolean;
}) {
  const Icon = reportIconMap[card.iconKey];
  const href = buildReportCardHref(card, from, to);

  return (
    <Link
      href={href}
      className={[
        "group rounded-2xl border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]",
        "bg-linear-to-br",
        reportColorMap[card.color],
        isActive
          ? "border-[#0f1f4d] ring-2 ring-blue-100"
          : "border-slate-200/80",
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
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await guardPageModule("reports");
  const company = session.company;
  const params = await searchParams;
  const now = new Date();
  const activeTab = parseReportTab(params.tab);
  const activeReport = parseReportView(params.report);
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? startOfMonth(now),
    parseDateParam(params.to) ?? endOfMonth(now)
  );

  const data = await getReportsPageData(company.id, {
    tab: activeTab,
    from,
    to,
  });

  const sections = resolveReportSections(activeReport, activeTab);
  const visibleCards = filterReportCards(activeTab, activeReport);
  const activeReportCard = activeReport ? getReportCardByKey(activeReport) : null;
  const exportHref = buildReportsExportQuery({
    tab: activeTab,
    report: activeReport,
    from,
    to,
  });

  const stockValue =
    data.summaryItems.find((item) => item.label === "Stok Değeri")?.value ?? 0;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
          <main className="space-y-5">
            {activeReportCard ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    href={buildReportsQuery({ tab: activeTab, from, to })}
                    className="inline-flex items-center gap-2 text-[12px] font-bold text-slate-500 transition hover:text-[#0f1f4d]"
                  >
                    <ArrowLeft size={16} />
                    Tüm Raporlar
                  </Link>
                  <h1 className="mt-2 text-[20px] font-black text-[#0f1f4d]">
                    {activeReportCard.title}
                  </h1>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">
                    {activeReportCard.description}
                  </p>
                </div>
              </div>
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleCards.map((card) => (
                  <ReportCardLink
                    key={card.key}
                    card={card}
                    from={from}
                    to={to}
                    isActive={false}
                  />
                ))}
              </section>
            )}

            <ReportsPageControls
              activeTab={activeTab}
              activeReport={activeReport}
              from={from}
              to={to}
            />

            {activeReport ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleCards
                  .filter((card) => card.key !== activeReport)
                  .map((card) => (
                    <ReportCardLink
                      key={card.key}
                      card={card}
                      from={from}
                      to={to}
                      isActive={false}
                    />
                  ))}
              </section>
            ) : null}

            {sections.showKpi ? (
              <section className="grid gap-4 lg:grid-cols-3">
                {data.kpiCards.map((item) => (
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
                            kpiColorMap[item.color],
                          ].join(" ")}
                        >
                          {formatReportMoney(item.value)}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-500">
                            Önceki dönem: {formatReportMoney(item.previousValue)}
                          </span>
                          <span
                            className={[
                              "rounded-full px-2 py-1 text-[10px] font-black",
                              item.positive
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-500",
                            ].join(" ")}
                          >
                            {item.positive ? "↑" : "↓"} %{Math.abs(item.changePercent)}
                          </span>
                        </div>
                      </div>

                      <ReportMiniLine
                        data={item.miniLineData}
                        color={item.lineColor}
                      />
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {sections.showSalesSummary ? (
              <section className="grid gap-4 md:grid-cols-3">
                <MetricTile
                  label="Toplam Satış Cirosu"
                  value={formatReportMoney(data.totalSales)}
                />
                <MetricTile
                  label="Satış Adedi"
                  value={formatNumber(data.salesCount)}
                />
                <MetricTile
                  label="Ortalama Sepet"
                  value={formatReportMoney(data.averageSaleAmount)}
                />
              </section>
            ) : null}

            {(sections.showIncomeExpenseChart || sections.showCashFlowChart) && (
              <section
                className={[
                  "grid gap-4",
                  sections.showIncomeExpenseChart && sections.showCashFlowChart
                    ? "xl:grid-cols-[0.95fr_1.05fr]"
                    : "grid-cols-1",
                ].join(" ")}
              >
                {sections.showIncomeExpenseChart ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-black text-[#0f1f4d]">
                        Gelir - Gider Dağılımı
                      </h3>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {data.periodLabel}
                      </p>
                    </div>

                    <FinanceBarChart data={data.monthlyFinanceData} />
                  </div>
                ) : null}

                {sections.showCashFlowChart ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <div className="mb-4">
                      <h3 className="text-[15px] font-black text-[#0f1f4d]">
                        Nakit Akış Özeti
                      </h3>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        Tahsilat {formatReportMoney(data.financeBreakdown.saleCollectionIncome)} ·
                        Manuel {formatReportMoney(data.financeBreakdown.manualIncome)}
                      </p>
                    </div>

                    <CashFlowChart data={data.monthlyFinanceData} />
                  </div>
                ) : null}
              </section>
            )}

            {sections.showCashFlowBreakdown ? (
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Satış Tahsilatı"
                  value={formatReportMoney(data.financeBreakdown.saleCollectionIncome)}
                />
                <MetricTile
                  label="Manuel Gelir"
                  value={formatReportMoney(data.financeBreakdown.manualIncome)}
                />
                <MetricTile
                  label="Transfer Giriş"
                  value={formatReportMoney(data.financeBreakdown.transferInTotal)}
                />
                <MetricTile
                  label="Net Nakit Akışı"
                  value={formatReportMoney(data.netProfit)}
                />
              </section>
            ) : null}

            {sections.showExpenseCategories ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4">
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    Gider Kategorileri
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {data.periodLabel}
                  </p>
                </div>

                <ExpenseDonutChart
                  data={data.expenseCategories}
                  total={data.totalExpenses}
                />
              </section>
            ) : null}

            {sections.showTopProducts ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-black text-[#0f1f4d]">
                      {activeReport === "products"
                        ? "Ürün Performansları"
                        : "En Çok Satan Ürünler"}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {activeReport === "products"
                        ? "Seçili dönemdeki satış adedi ve ciro"
                        : `Satış cirosu: ${formatReportMoney(data.totalSales)}`}
                    </p>
                  </div>
                </div>

                <TopProductsTable data={data.topProducts} />
              </section>
            ) : null}

            {sections.showStockSummary ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <h3 className="text-[15px] font-black text-[#0f1f4d]">
                  Stok Özeti
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricTile
                    label="Stok Değeri"
                    value={formatReportMoney(stockValue)}
                  />
                  <MetricTile
                    label="Takip Edilen Ürün"
                    value={formatNumber(data.trackedStockCount)}
                  />
                  <MetricTile
                    label="Düşük Stok"
                    value={formatNumber(data.lowStockCount)}
                  />
                </div>
              </section>
            ) : null}

            {sections.showStockTable ? (
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="mb-4">
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    Stok Durum Tablosu
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    Minimum stok altındaki ürünler işaretlenir
                  </p>
                </div>

                <StockReportTable data={data.stockItems} />
              </section>
            ) : null}

            {sections.showCustomerSummary ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                  <h3 className="text-[15px] font-black text-[#0f1f4d]">
                    Müşteri Özeti
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {data.summaryItems
                      .filter((item) =>
                        [
                          "Toplam Alacak",
                          "Toplam Borç",
                          "Vadesi Gelen Alacak",
                        ].includes(item.label)
                      )
                      .map((item) => (
                        <div
                          key={item.label}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                        >
                          <p className="text-[11px] font-bold text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-[18px] font-black text-[#0f1f4d]">
                            {formatReportMoney(item.value)}
                          </p>
                        </div>
                      ))}
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      <p className="text-[11px] font-bold text-slate-500">
                        Toplam Müşteri
                      </p>
                      <p className="mt-1 text-[18px] font-black text-[#0f1f4d]">
                        {formatNumber(data.totalCustomers)}
                      </p>
                    </div>
                  </div>
                </div>

                {data.customerReportItems.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                    <h3 className="text-[15px] font-black text-[#0f1f4d]">
                      Bakiyesi Olan Müşteriler
                    </h3>
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                            <th className="px-4 py-3">Müşteri</th>
                            <th className="px-4 py-3">Tür</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.customerReportItems.map((item) => (
                            <tr
                              key={item.id}
                              className="text-[12px] font-semibold text-[#24345f]"
                            >
                              <td className="px-4 py-3 font-extrabold text-[#0f1f4d]">
                                {item.name}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={[
                                    "rounded-md px-2 py-1 text-[10px] font-black",
                                    item.kind === "receivable"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-rose-50 text-rose-700",
                                  ].join(" ")}
                                >
                                  {item.kind === "receivable" ? "Alacak" : "Borç"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-[#0f1f4d]">
                                {formatReportMoney(item.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <p className="text-center text-[11px] font-semibold text-slate-400">
              Son güncelleme: {formatReportDateTime(data.lastUpdatedAt)}
            </p>
          </main>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Özet Bilgiler
              </h3>

              <div className="space-y-4">
                {data.summaryItems.map((item) => {
                  const Icon = summaryIconMap[item.iconKey];

                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className={[
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                          summaryColorMap[item.color],
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
                        {formatReportMoney(item.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <h3 className="mb-4 text-[15px] font-black text-[#0f1f4d]">
                Kısayollar
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={exportHref}
                  className="group flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-center transition hover:bg-slate-100"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                    <Download size={18} strokeWidth={2.5} />
                  </span>
                  <span className="text-[11px] font-black text-[#24345f]">
                    Excel İndir
                  </span>
                </a>

                {[
                  {
                    label: "Personel Raporu",
                    icon: Users,
                    color: "bg-blue-50 text-blue-600",
                    href: "/reports/personnel-performance",
                  },
                  {
                    label: "Kasa-Banka",
                    icon: Wallet,
                    color: "bg-emerald-50 text-emerald-600",
                    href: "/cash-bank",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
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
                    </Link>
                  );
                })}

                <button
                  type="button"
                  disabled
                  className="group flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-center opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                    <ReceiptText size={18} strokeWidth={2.5} />
                  </span>
                  <span className="text-[11px] font-black text-[#24345f]">
                    PDF (yakında)
                  </span>
                </button>

                <button
                  type="button"
                  disabled
                  className="group flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-center opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Mail size={18} strokeWidth={2.5} />
                  </span>
                  <span className="text-[11px] font-black text-[#24345f]">
                    E-posta (yakında)
                  </span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-[18px] font-black text-[#0f1f4d]">{value}</p>
    </div>
  );
}
