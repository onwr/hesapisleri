import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock3,
  FilePlus2,
  FileText,
  LayoutGrid,
  ReceiptText,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { InvoicesRowActions } from "@/components/invoices/invoices-row-actions";
import {
  InvoicesTablePagination,
  InvoicesTableToolbar,
} from "@/components/invoices/invoices-table-controls";
import { InvoicesSidebarWidgets } from "@/components/invoices/invoices-sidebar-widgets";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getInvoiceCollectionAccounts } from "@/lib/invoice-service";
import { db } from "@/lib/prisma";
import { getInvoicesPageData } from "@/lib/invoices-page-data";
import {
  buildInvoicesQuery,
  formatDateDisplay,
  formatInvoiceDate,
  formatInvoiceMoney,
  getPaymentClass,
  getPaymentText,
  mapInvoiceRowActions,
  normalizeDateRange,
  parseDateParam,
  parseInvoiceTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/invoices-page-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type InvoicesPageProps = {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
};

const actionIconMap = {
  filePlus: FilePlus2,
  file: FileText,
  clock: Clock3,
  alert: AlertTriangle,
  grid: LayoutGrid,
};

const statIconMap = {
  file: FileText,
  receipt: ReceiptText,
  clock: Clock3,
  alert: AlertTriangle,
  calendar: CalendarDays,
};

const colorClassMap = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  orange: "bg-orange-50 text-orange-500",
  rose: "bg-rose-50 text-rose-500",
  violet: "bg-violet-50 text-violet-600",
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
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
  const activeTab = parseInvoiceTab(params.tab);
  const currentPage = parsePage(params.page);
  const searchQuery = parseSearchQuery(params.q);
  const defaultFrom = startOfMonth(now);
  const defaultTo = endOfMonth(now);
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from) ?? defaultFrom,
    parseDateParam(params.to) ?? defaultTo
  );

  const {
    rows,
    statCards,
    actionCards,
    distribution,
    periodInvoiceCount,
    totalRecords,
    totalPages,
    currentPage: page,
    exportHref,
  } = await getInvoicesPageData(company.id, {
    tab: activeTab,
    page: currentPage,
    from,
    to,
    q: searchQuery,
  });

  const collectionAccounts = await getInvoiceCollectionAccounts(company.id);

  const hasFilters =
    Boolean(searchQuery) ||
    activeTab !== "all" ||
    parseDateParam(params.from) !== null ||
    parseDateParam(params.to) !== null;

  return (
    <AppShell>
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {actionCards.map((card) => {
            const Icon = actionIconMap[card.iconKey];

            return (
              <Link
                key={card.title}
                href={card.href}
                className={[
                  "group flex h-[86px] items-center justify-between rounded-2xl bg-linear-to-br p-4 text-white shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)]",
                  card.gradient,
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/15 shadow-inner">
                    <Icon size={22} strokeWidth={2.4} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-black leading-tight">
                      {card.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-medium text-white/85">
                      {card.description}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={18}
                  strokeWidth={3}
                  className="shrink-0 opacity-90 transition group-hover:translate-x-1 group-hover:opacity-100"
                />
              </Link>
            );
          })}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

                    <p className="mt-3 text-[20px] font-black tracking-[-0.03em] text-[#0f1f4d]">
                      {stat.value}
                    </p>
                  </div>

                  <div
                    className={[
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                      colorClassMap[stat.color],
                    ].join(" ")}
                  >
                    <Icon size={22} strokeWidth={2.4} />
                  </div>
                </div>

                <p className="mt-3 text-[11px] font-semibold text-slate-500">
                  {stat.subtitle}
                </p>
              </div>
            );
          })}
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
            <InvoicesTableToolbar
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-[#24345f]/80">
                    <th className="px-2 py-2.5">Fatura No</th>
                    <th className="px-2 py-2.5">Müşteri</th>
                    <th className="px-2 py-2.5">Fatura Tarihi</th>
                    <th className="px-2 py-2.5">Vade Tarihi</th>
                    <th className="px-2 py-2.5 text-right">Tutar</th>
                    <th className="px-2 py-2.5 text-right">Tahsil Edilen</th>
                    <th className="px-2 py-2.5 text-right">Kalan</th>
                    <th className="px-2 py-2.5">Tahsilat Durumu</th>
                    <th className="w-[120px] px-2 py-2.5 text-center">İşlem</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="text-[12px] font-semibold text-[#24345f] transition hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-2 py-2.5 font-extrabold text-blue-600">
                        {invoice.invoiceNo}
                      </td>

                      <td className="max-w-[160px] truncate px-2 py-2.5 font-extrabold text-[#0f1f4d]">
                        {invoice.customerName}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-slate-600">
                        {formatInvoiceDate(invoice.issueDate)}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-[11px]">
                        <span
                          className={
                            invoice.isOverdue
                              ? "font-black text-rose-500"
                              : "text-slate-600"
                          }
                        >
                          {formatInvoiceDate(invoice.dueDate)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black text-[#0f1f4d]">
                        {formatInvoiceMoney(invoice.amount)}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black text-emerald-600">
                        {formatInvoiceMoney(invoice.paidAmount)}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right text-[12px] font-black text-orange-600">
                        {formatInvoiceMoney(invoice.remainingAmount)}
                      </td>

                      <td className="px-2 py-2.5">
                        <span
                          className={[
                            "inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black",
                            getPaymentClass(invoice.paymentStatus),
                          ].join(" ")}
                        >
                          {getPaymentText(invoice.paymentStatus)}
                        </span>
                      </td>

                      <td className="px-2 py-2.5">
                        <InvoicesRowActions
                          row={mapInvoiceRowActions(invoice)}
                          accounts={collectionAccounts}
                        />
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-sm">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
                            <FileText size={28} />
                          </div>

                          <p className="mt-4 text-lg font-black text-[#0f1f4d]">
                            {hasFilters
                              ? "Bu filtrede fatura bulunamadı"
                              : "Henüz fatura yok"}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {hasFilters
                              ? "Arama, tarih veya sekme filtrenizi değiştirerek tekrar deneyebilirsiniz."
                              : "İlk faturanızı oluşturarak tahsilat takibine başlayabilirsiniz."}
                          </p>

                          <Link
                            href={
                              hasFilters
                                ? buildInvoicesQuery({ tab: activeTab, from, to })
                                : "/invoices/new"
                            }
                            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-violet-600 px-5 text-sm font-black text-white"
                          >
                            {hasFilters ? "Filtreyi Temizle" : "İlk Faturayı Oluştur"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <InvoicesTablePagination
              activeTab={activeTab}
              from={from}
              to={to}
              searchQuery={searchQuery}
              totalPages={totalPages}
              currentPage={page}
              totalRecords={totalRecords}
            />
          </section>

          <aside className="space-y-4">
            <InvoicesSidebarWidgets
              distribution={distribution}
              totalCount={periodInvoiceCount}
              fromLabel={formatDateDisplay(from)}
              toLabel={formatDateDisplay(to)}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
