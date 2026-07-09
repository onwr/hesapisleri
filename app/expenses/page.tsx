import Link from "next/link";
import {
  Download,
  Edit3,
  Eye,
  FileText,
  Hourglass,
  MoreVertical,
  ReceiptText,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { guardPageModule } from "@/lib/module-access";
import {
  CompactActionCard,
} from "@/components/cards/compact-action-card";
import { CompactActionCardGrid } from "@/components/cards/compact-action-card-grid";

import {
  ExpensesTablePagination,
  ExpensesTableToolbar,
} from "@/components/expenses/expenses-table-controls";
import { ExpensesSidebarWidgets } from "@/components/expenses/expenses-sidebar-widgets";
import { resolveMonthFinancialPeriod } from "@/lib/finance/financial-period";
import { getExpenseDisplayPaymentBadge } from "@/lib/expense-utils";
import { getActiveExpenseCategoryNames } from "@/lib/expense-category-service";
import {
  getExpensesPageData,
  parseExpenseCategoryFilter,
} from "@/lib/expenses-page-data";
import { getCachedExpensesPageData } from "@/lib/tenant-cache/cached-tenant-page-data";
import { TenantPageSync } from "@/components/tenant-cache/tenant-page-sync";
import {
  buildExpensesExportQuery,
  formatExpenseDate,
  formatExpenseMoney,
  getCategoryBadge,
  getCategoryIconStyle,
  getExpenseStatusBadge,
  normalizeDateRange,
  parseDateParam,
  parseExpenseTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/expenses-page-utils";

type ExpensesPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
    q?: string;
    category?: string;
  }>;
};

const statIconMap = {
  receipt: ReceiptText,
  file: FileText,
  trending: TrendingDown,
  wallet: Wallet,
  hourglass: Hourglass,
};

const colorClassMap = {
  blue: "bg-blue-50 text-blue-600",
  rose: "bg-rose-50 text-rose-500",
  orange: "bg-orange-50 text-orange-500",
  violet: "bg-violet-50 text-violet-600",
};

function buildActionCards(exportHref: string) {
  return [
    {
      title: "Yeni Gider",
      description: "Manuel gider kaydı oluşturun",
      href: "/expenses/new",
      iconName: "plus" as const,
      color: "orange" as const,
    },
    {
      title: "Toplu İşlemler",
      description: "Seçili giderlerde toplu aksiyon",
      href: "/expenses/bulk-actions",
      iconName: "repeat" as const,
      color: "rose" as const,
    },
    {
      title: "Kategoriler",
      description: "Gider kategorilerini yönetin",
      href: "/expenses/categories",
      iconName: "boxes" as const,
      color: "violet" as const,
    },
    {
      title: "Ödeme Bekleyenler",
      description: "Ödeme bekleyen giderleri görün",
      href: "/expenses?tab=unpaid",
      iconName: "hourglass" as const,
      color: "amber" as const,
    },
    {
      title: "Dışa Aktar",
      description: "Excel olarak indir",
      href: exportHref,
      iconName: "download" as const,
      color: "blue" as const,
    },
  ];
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const session = await guardPageModule("expenses");
  const company = session.company;
  const params = await searchParams;
  const now = new Date();
  const activeTab = parseExpenseTab(params.tab);
  const currentPage = parsePage(params.page);
  const searchQuery = parseSearchQuery(params.q);
  const categoryFilter = parseExpenseCategoryFilter(params.category);
  const month = resolveMonthFinancialPeriod({ referenceDate: now });
  const defaultFrom = month.from;
  const defaultTo = month.toInclusive;
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? defaultFrom,
    parseDateParam(params.to) ?? defaultTo
  );

  const categoryOptions = await getActiveExpenseCategoryNames(company.id);

  const {
    statCards,
    rows,
    monthlyBreakdown,
    categoryBreakdown,
    monthlyTotal,
    totalRecords,
    totalPages,
    currentPage: page,
  } = await getCachedExpensesPageData({
    companyId: company.id,
    tab: activeTab,
    page: currentPage,
    from,
    to,
    q: searchQuery,
    category: categoryFilter,
  });

  const exportHref = buildExpensesExportQuery({
    tab: activeTab,
    from,
    to,
    q: searchQuery,
    category: categoryFilter,
  });

  const actionCards = buildActionCards(exportHref);
  const hasFilters =
    Boolean(searchQuery) ||
    Boolean(categoryFilter) ||
    activeTab !== "all" ||
    parseDateParam(params.from) !== null ||
    parseDateParam(params.to) !== null;

  return (
    <AppShell>
      <TenantPageSync />
      <div className="space-y-5">
        <CompactActionCardGrid columns="5">
          {actionCards.map((card) => (
            <CompactActionCard
              key={card.title}
              title={card.title}
              description={card.description}
              href={card.href}
              iconName={card.iconName}
              color={card.color}
            />
          ))}
        </CompactActionCardGrid>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {statCards.map((stat) => {
            const Icon = statIconMap[stat.iconKey];

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-extrabold text-[#24345f]/80">
                      {stat.title}
                    </p>

                    <p className="mt-2 text-[22px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={18} strokeWidth={2.3} />
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span>{stat.subtitle}</span>

                  {stat.change ? (
                    <span
                      className={[
                        "inline-flex rounded-full px-2 py-1 text-[10px] font-black leading-none",
                        stat.positive
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-rose-50 text-rose-600",
                      ].join(" ")}
                    >
                      {stat.positive ? "↓" : "↑"} {stat.change}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <ExpensesTableToolbar
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              categoryFilter={categoryFilter}
              categories={categoryOptions}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                    <th className="whitespace-nowrap px-2 py-2.5">Tarih</th>
                    <th className="px-2 py-2.5">Gider Adı</th>
                    <th className="px-2 py-2.5">Kategori</th>
                    <th className="px-2 py-2.5">Tedarikçi</th>
                    <th className="px-2 py-2.5">Belge No</th>
                    <th className="px-2 py-2.5 text-right">Tutar</th>
                    <th className="px-2 py-2.5">Ödeme</th>
                    <th className="px-2 py-2.5">Durum</th>
                    <th className="w-[72px] px-2 py-2.5 text-center">İşlem</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((expense) => {
                    const statusBadge = getExpenseStatusBadge(expense.status);
                    const paymentBadge = getExpenseDisplayPaymentBadge(expense);

                    return (
                      <tr
                        key={expense.id}
                        className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                      >
                        <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-500">
                          {formatExpenseDate(expense.date)}
                        </td>

                        <td className="max-w-[180px] px-2 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <div
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                getCategoryIconStyle(expense.categoryName),
                              ].join(" ")}
                            >
                              <ReceiptText size={14} strokeWidth={2.4} />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-extrabold text-[#0f1f4d]">
                                {expense.title}
                              </p>
                              {expense.note ? (
                                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                                  {expense.note}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              getCategoryBadge(expense.categoryName),
                            ].join(" ")}
                          >
                            {expense.categoryName}
                          </span>
                        </td>

                        <td className="max-w-[120px] truncate px-2 py-2.5 text-slate-600">
                          {expense.supplier || "-"}
                        </td>

                        <td className="max-w-[108px] truncate px-2 py-2.5 text-[11px] font-bold text-[#24345f]">
                          {expense.documentNo}
                        </td>

                        <td className="whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black text-rose-500">
                          {formatExpenseMoney(expense.amount)}
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              paymentBadge.className,
                            ].join(" ")}
                          >
                            {paymentBadge.label}
                          </span>
                        </td>

                        <td className="px-2 py-2.5">
                          <span
                            className={[
                              "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                              statusBadge.className,
                            ].join(" ")}
                          >
                            {statusBadge.label}
                          </span>
                        </td>

                        <td className="px-2 py-2.5">
                          <div className="mx-auto grid w-[62px] grid-cols-2 gap-1">
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Detay"
                            >
                              <Eye size={13} />
                            </Link>

                            {expense.status !== "CANCELLED" ? (
                              <Link
                                href={`/expenses/${expense.id}/edit`}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                                title="Düzenle"
                              >
                                <Edit3 size={13} />
                              </Link>
                            ) : (
                              <span
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-300"
                                title="İptal edilmiş"
                              >
                                <Edit3 size={13} />
                              </span>
                            )}

                            <a
                              href={exportHref}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                              title="Listeyi indir"
                            >
                              <Download size={13} />
                            </a>

                            <Link
                              href={`/expenses/${expense.id}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-[#24345f] transition hover:bg-slate-50"
                              title="Diğer"
                            >
                              <MoreVertical size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-600">
                            <ReceiptText size={28} />
                          </div>

                          <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                            {hasFilters
                              ? "Bu filtrede gider bulunamadı"
                              : "Henüz gider yok"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {hasFilters
                              ? "Arama, tarih veya sekme filtrenizi değiştirerek tekrar deneyebilirsiniz."
                              : "İlk giderinizi ekleyerek harcamalarınızı takip etmeye başlayabilirsiniz."}
                          </p>

                          <Link
                            href={hasFilters ? "/expenses" : "/expenses/new"}
                            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-orange-600 px-5 text-sm font-black text-white"
                          >
                            {hasFilters ? "Filtreyi Temizle" : "İlk Gideri Ekle"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <ExpensesTablePagination
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              categoryFilter={categoryFilter}
              totalPages={totalPages}
              currentPage={page}
              totalRecords={totalRecords}
            />
          </section>

          <aside className="space-y-4">
            <ExpensesSidebarWidgets
              monthlyBreakdown={monthlyBreakdown}
              categoryBreakdown={categoryBreakdown}
              monthlyTotal={monthlyTotal}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
