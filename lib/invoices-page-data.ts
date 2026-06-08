import { db } from "@/lib/prisma";
import { endOfLastMonth, startOfLastMonth } from "@/lib/dashboard-metrics";
import {
  buildInvoiceDistribution,
  buildInvoicesExportQuery,
  buildInvoicesQuery,
  filterInvoicesByTab,
  formatInvoiceMoney,
  getInvoiceDueDate,
  isInDateRange,
  isInvoiceOverdue,
  matchesInvoiceSearch,
  type InvoiceActionCard,
  type InvoiceDistributionItem,
  type InvoiceStatCard,
  type InvoiceTabKey,
  type InvoiceTableRow,
} from "@/lib/invoices-page-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { getInvoiceEditHref } from "@/lib/invoice-detail-utils";

export type {
  InvoiceActionCard,
  InvoiceDistributionItem,
  InvoiceStatCard,
  InvoiceTabKey,
  InvoiceTableRow,
} from "@/lib/invoices-page-utils";

export {
  INVOICE_TAB_LABELS,
  buildInvoicesExportQuery,
  buildInvoicesQuery,
  formatDateDisplay,
  formatDateInputValue,
  formatInvoiceDate,
  formatInvoiceMoney,
  getPaymentClass,
  getPaymentText,
  normalizeDateRange,
  parseDateParam,
  parseInvoiceTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/invoices-page-utils";

const PAGE_SIZE = 10;

type RawInvoice = {
  id: string;
  invoiceNo: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null;
  total: unknown;
  paidAmount: unknown;
  paymentStatus: string;
  status: string;
  pdfUrl: string | null;
  saleId: string | null;
  customer: { name: string } | null;
};

function mapInvoiceRow(invoice: RawInvoice, now = new Date()): InvoiceTableRow {
  const dueDate = getInvoiceDueDate(invoice.createdAt, invoice.dueDate);
  const amount = Number(invoice.total);
  const paidAmount = Number(invoice.paidAmount);
  const remainingAmount = getInvoiceRemainingAmount(amount, paidAmount);
  const overdue = isInvoiceOverdue(
    invoice.paymentStatus,
    invoice.createdAt,
    invoice.dueDate,
    now
  );

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    customerName: invoice.customer?.name ?? "Müşteri seçilmedi",
    issueDate: invoice.createdAt,
    dueDate,
    amount,
    paidAmount,
    remainingAmount,
    paymentStatus: invoice.paymentStatus,
    invoiceStatus: invoice.status,
    invoiceType: invoice.type,
    pdfUrl: invoice.pdfUrl,
    saleId: invoice.saleId,
    detailHref: `/invoices/${invoice.id}`,
    editHref: getInvoiceEditHref({
      id: invoice.id,
      status: invoice.status,
      type: invoice.type,
    }),
    downloadHref: invoice.pdfUrl ?? `/api/invoices/${invoice.id}/pdf`,
    isOverdue: overdue,
  };
}

function calculateAveragePaymentDays(invoices: RawInvoice[]) {
  const paidInvoices = invoices.filter(
    (invoice) => invoice.paymentStatus === "PAID"
  );

  if (paidInvoices.length === 0) {
    return 0;
  }

  const totalDays = paidInvoices.reduce((sum, invoice) => {
    const diffMs = invoice.updatedAt.getTime() - invoice.createdAt.getTime();
    return sum + Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, 0);

  return Math.round(totalDays / paidInvoices.length);
}

function buildActionCards(stats: {
  draftCount: number;
  pendingTotal: number;
  overdueCount: number;
  exportHref: string;
}): InvoiceActionCard[] {
  return [
    {
      title: "Yeni Fatura Kes",
      description: "Hızlı fatura oluştur",
      href: "/invoices/new",
      iconKey: "filePlus",
      gradient: "from-emerald-500 to-green-600",
    },
    {
      title: "Taslak Faturalar",
      description: `${stats.draftCount} taslak fatura`,
      href: buildInvoicesQuery({ tab: "draft" }),
      iconKey: "file",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Bekleyen Tahsilatlar",
      description: formatInvoiceMoney(stats.pendingTotal),
      href: buildInvoicesQuery({ tab: "pending" }),
      iconKey: "clock",
      gradient: "from-orange-400 to-orange-600",
    },
    {
      title: "Geciken Faturalar",
      description: `${stats.overdueCount} adet geciken`,
      href: buildInvoicesQuery({ tab: "overdue" }),
      iconKey: "alert",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Toplu İşlemler",
      description: "Faturaları dışa aktar",
      href: stats.exportHref,
      iconKey: "grid",
      gradient: "from-rose-400 to-pink-600",
    },
  ];
}

export async function getInvoicesPageData(
  companyId: string,
  options: {
    tab: InvoiceTabKey;
    page: number;
    from: Date;
    to: Date;
    q?: string | null;
  }
) {
  const now = new Date();
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

  const invoicesRaw = await db.invoice.findMany({
    where: { companyId },
    include: { customer: true, sale: true },
    orderBy: { createdAt: "desc" },
  });

  const allRows = invoicesRaw.map((invoice) => mapInvoiceRow(invoice, now));
  const periodRows = allRows.filter((row) =>
    isInDateRange(row.issueDate, options.from, options.to)
  );

  const draftCount = allRows.filter((row) => row.invoiceStatus === "DRAFT").length;
  const pendingRows = allRows.filter(
    (row) =>
      row.remainingAmount > 0 &&
      row.invoiceStatus !== "DRAFT" &&
      row.invoiceStatus !== "CANCELLED" &&
      !row.saleId &&
      !row.isOverdue
  );
  const overdueRows = allRows.filter((row) => row.isOverdue && !row.saleId);

  const pendingTotal = pendingRows.reduce((sum, row) => sum + row.remainingAmount, 0);
  const overdueTotal = overdueRows.reduce((sum, row) => sum + row.remainingAmount, 0);
  const overdueCount = overdueRows.length;

  const periodTotal = periodRows.reduce((sum, row) => sum + row.amount, 0);
  const paidPeriodRows = periodRows.filter((row) => row.paymentStatus === "PAID");
  const paidPeriodTotal = paidPeriodRows.reduce((sum, row) => sum + row.paidAmount, 0);
  const collectionRate =
    periodTotal > 0 ? Math.round((paidPeriodTotal / periodTotal) * 1000) / 10 : 0;

  const averagePaymentDays = calculateAveragePaymentDays(invoicesRaw);
  const lastMonthAverage = calculateAveragePaymentDays(
    invoicesRaw.filter((invoice) =>
      isInDateRange(invoice.createdAt, lastMonthStart, lastMonthEnd)
    )
  );

  const statCards: InvoiceStatCard[] = [
    {
      title: "Bu Dönem Kesilen Fatura",
      value: String(periodRows.length),
      subtitle: formatInvoiceMoney(periodTotal),
      iconKey: "file",
      color: "emerald",
    },
    {
      title: "Bu Dönem Tahsil Edilen",
      value: formatInvoiceMoney(paidPeriodTotal),
      subtitle: `%${collectionRate} tahsilat oranı`,
      iconKey: "receipt",
      color: "blue",
    },
    {
      title: "Bekleyen Tahsilat",
      value: formatInvoiceMoney(pendingTotal),
      subtitle: `${pendingRows.length} fatura`,
      iconKey: "clock",
      color: "orange",
    },
    {
      title: "Geciken Tahsilat",
      value: formatInvoiceMoney(overdueTotal),
      subtitle: `${overdueCount} fatura`,
      iconKey: "alert",
      color: "rose",
    },
    {
      title: "Ortalama Ödeme Süresi",
      value: `${averagePaymentDays} gün`,
      subtitle: `Geçen ay: ${lastMonthAverage} gün`,
      iconKey: "calendar",
      color: "violet",
    },
  ];

  let filteredRows = filterInvoicesByTab(allRows, options.tab);

  filteredRows = filteredRows.filter((row) =>
    isInDateRange(row.issueDate, options.from, options.to)
  );

  if (options.q) {
    filteredRows = filteredRows.filter((row) =>
      matchesInvoiceSearch(row, options.q!)
    );
  }

  const totalRecords = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const rows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  const distribution = buildInvoiceDistribution(periodRows);

  const exportHref = buildInvoicesExportQuery({
    tab: options.tab,
    from: options.from,
    to: options.to,
    q: options.q,
  });

  const actionCards = buildActionCards({
    draftCount,
    pendingTotal,
    overdueCount,
    exportHref,
  });

  return {
    rows,
    statCards,
    actionCards,
    distribution,
    periodInvoiceCount: periodRows.length,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
    exportHref,
  };
}

export async function getInvoicesExportRows(
  companyId: string,
  options: {
    tab: InvoiceTabKey;
    from: Date;
    to: Date;
    q?: string | null;
  }
) {
  const invoicesRaw = await db.invoice.findMany({
    where: { companyId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  let rows = filterInvoicesByTab(
    invoicesRaw.map((invoice) => mapInvoiceRow(invoice, now)),
    options.tab
  );

  rows = rows.filter((row) => isInDateRange(row.issueDate, options.from, options.to));

  if (options.q) {
    rows = rows.filter((row) => matchesInvoiceSearch(row, options.q!));
  }

  return rows;
}
