import { db } from "@/lib/prisma";
import {
  endOfLastMonth,
  endOfMonth,
  formatMoney,
  percentChange,
  startOfDay,
  startOfLastMonth,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import { getCollectedAmount, getSaleRemainingAmount } from "@/lib/sale-payment-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import {
  formatShortDateTime,
  normalizeDateRange,
  buildSalesExportQuery,
  type SalesDocumentRow,
  type SalesStatCard,
  type SalesTabKey,
} from "@/lib/sales-page-utils";
import { validateSaleCancelEligibility } from "@/lib/sale-mutation-policy";
import {
  activeInvoiceStatusFilter,
  activeSaleStatusFilter,
  isActiveInvoiceStatus,
  isActiveSaleStatus,
} from "@/lib/sale-query-utils";

export type { SalesDocumentRow, SalesStatCard, SalesTabKey } from "@/lib/sales-page-utils";
export {
  buildSalesQuery,
  buildSalesExportQuery,
  formatDateDisplay,
  formatDateInputValue,
  formatShortDateTime,
  parseDateParam,
  parsePage,
  parseSalesTab,
  SALES_TAB_LABELS,
  toSalesRowActionData,
} from "@/lib/sales-page-utils";

const PAGE_SIZE = 10;

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sumTotal<T extends { total: unknown }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.total), 0);
}

function buildChangeLabel(current: number, previous: number, invert = false) {
  const change = percentChange(current, previous);
  const improved = invert ? change <= 0 : change >= 0;

  return {
    change: `${change >= 0 ? "+" : ""}${change}%`.replace("+-", "-"),
    positive: improved,
  };
}

async function fetchDocuments(companyId: string) {
  const [sales, invoices, collections] = await Promise.all([
    db.sale.findMany({
      where: { companyId },
      include: {
        customer: true,
        invoice: {
          include: {
            documentSubmission: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({
      where: { companyId },
      include: { customer: true, sale: true },
      orderBy: { createdAt: "desc" },
    }),
    db.accountTransaction.findMany({
      where: {
        type: "INCOME",
        account: { companyId },
      },
      include: { account: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const invoiceRows: SalesDocumentRow[] = invoices
    .filter((invoice) => isActiveInvoiceStatus(invoice.status))
    .map((invoice) => {
      const totalAmount = Number(invoice.total);
      const paidAmount = Number(invoice.paidAmount);
      const remainingAmount = getInvoiceRemainingAmount(totalAmount, paidAmount);

      return {
        id: `invoice-${invoice.id}`,
        createdAt: invoice.createdAt,
        documentNo: invoice.invoiceNo,
        customerName: invoice.customer?.name ?? "Müşteri seçilmedi",
        typeLabel: "Fatura",
        typeBadgeClass: "bg-violet-100 text-violet-700",
        amount: totalAmount,
        paymentStatus: invoice.paymentStatus,
        saleStatus: invoice.status,
        detailHref: `/invoices/${invoice.id}`,
        pdfUrl: invoice.pdfUrl,
        sourceType: "invoice" as const,
        sourceId: invoice.id,
        saleId: invoice.saleId,
        invoiceId: invoice.id,
        canCancel:
          invoice.status !== "CANCELLED" && invoice.status !== "APPROVED",
        canCreateInvoice: false,
        canCollect: remainingAmount > 0,
        canConvert: false,
        isQuote: false,
        downloadHref: invoice.pdfUrl
          ? invoice.pdfUrl
          : `/api/invoices/${invoice.id}/pdf`,
        collectTargetType: "INVOICE" as const,
        collectTargetId: invoice.id,
        totalAmount,
        paidAmount,
        remainingAmount,
      };
    });

  const collectionRows: SalesDocumentRow[] = collections.map((tx) => ({
    id: `collection-${tx.id}`,
    createdAt: tx.date,
    documentNo: `THS-${tx.id.slice(-8).toUpperCase()}`,
    customerName: tx.title.replace(/^Tahsilat:\s*/i, "") || "Tahsilat",
    typeLabel: "Tahsilat",
    typeBadgeClass: "bg-blue-100 text-blue-700",
    amount: Number(tx.amount),
    paymentStatus: "PAID",
    saleStatus: "COMPLETED",
    detailHref: "/cash-bank",
    pdfUrl: null,
    sourceType: "collection",
    sourceId: tx.id,
    saleId: null,
    invoiceId: null,
    canCancel: false,
    canCreateInvoice: false,
    canCollect: false,
    canConvert: false,
    isQuote: false,
    downloadHref: `/api/sales/export?collectionId=${tx.id}`,
  }));

  const returnRows: SalesDocumentRow[] = sales
    .filter((sale) => sale.status === "REFUNDED" || sale.status === "CANCELLED")
    .map((sale) => ({
      id: `return-${sale.id}`,
      createdAt: sale.createdAt,
      documentNo: sale.saleNo,
      customerName: sale.customer?.name ?? "Müşteri seçilmedi",
      typeLabel: "İade",
      typeBadgeClass: "bg-rose-100 text-rose-700",
      amount: -Math.abs(Number(sale.total)),
      paymentStatus: sale.paymentStatus,
      saleStatus: sale.status,
      detailHref: `/sales/${sale.id}`,
      pdfUrl: sale.invoice?.pdfUrl ?? null,
      sourceType: "sale",
      sourceId: sale.id,
      saleId: sale.id,
      invoiceId: sale.invoice?.id ?? null,
      canCancel: false,
      canCreateInvoice: false,
      canCollect: false,
      canConvert: false,
      isQuote: false,
      downloadHref: sale.invoice?.pdfUrl
        ? sale.invoice.pdfUrl
        : `/api/sales/export?saleId=${sale.id}`,
    }));

  const quoteRows: SalesDocumentRow[] = sales
    .filter((sale) => sale.status === "DRAFT")
    .map((sale) => ({
      id: `quote-${sale.id}`,
      createdAt: sale.createdAt,
      documentNo: sale.saleNo,
      customerName: sale.customer?.name ?? "Müşteri seçilmedi",
      typeLabel: "Teklif",
      typeBadgeClass: "bg-amber-100 text-amber-700",
      amount: Number(sale.total),
      paymentStatus: sale.paymentStatus,
      saleStatus: sale.status,
      detailHref: `/sales/${sale.id}`,
      pdfUrl: null,
      sourceType: "sale",
      sourceId: sale.id,
      saleId: sale.id,
      invoiceId: null,
      canCancel: true,
      canCreateInvoice: false,
      canCollect: false,
      canConvert: true,
      isQuote: true,
      downloadHref: `/api/sales/export?saleId=${sale.id}`,
    }));

  const standaloneSaleRows: SalesDocumentRow[] = sales
    .filter(
      (sale) =>
        !sale.invoice &&
        sale.status !== "REFUNDED" &&
        sale.status !== "CANCELLED" &&
        sale.status !== "DRAFT"
    )
    .map((sale) => {
      const totalAmount = Number(sale.total);
      const paidAmount = Number(sale.paidAmount);
      const remainingAmount = getSaleRemainingAmount(totalAmount, paidAmount);

      return {
        id: `sale-${sale.id}`,
        createdAt: sale.createdAt,
        documentNo: sale.saleNo,
        customerName: sale.customer?.name ?? "Müşteri seçilmedi",
        typeLabel: "Satış",
        typeBadgeClass: "bg-emerald-100 text-emerald-700",
        amount: totalAmount,
        paymentStatus: sale.paymentStatus,
        saleStatus: sale.status,
        detailHref: `/sales/${sale.id}`,
        pdfUrl: sale.invoice?.pdfUrl ?? null,
        sourceType: "sale" as const,
        sourceId: sale.id,
        saleId: sale.id,
        invoiceId: sale.invoice?.id ?? null,
        canCancel: validateSaleCancelEligibility(sale).ok,
        canCreateInvoice: !sale.invoice && sale.status === "COMPLETED",
        canCollect: remainingAmount > 0,
        canConvert: false,
        isQuote: false,
        downloadHref: sale.invoice?.pdfUrl
          ? sale.invoice.pdfUrl
          : `/api/sales/export?saleId=${sale.id}`,
        collectTargetType: "SALE" as const,
        collectTargetId: sale.id,
        totalAmount,
        paidAmount,
        remainingAmount,
      };
    });

  return {
    all: [...invoiceRows, ...collectionRows, ...returnRows, ...standaloneSaleRows],
    invoices: invoiceRows,
    collections: collectionRows,
    offers: quoteRows,
    returns: returnRows,
  };
}

function filterByDateRange(rows: SalesDocumentRow[], from: Date, to: Date) {
  const end = endOfDay(to);

  return rows.filter(
    (row) => row.createdAt >= from && row.createdAt <= end
  );
}

export async function getSalesPageData(
  companyId: string,
  options: {
    tab: SalesTabKey;
    page: number;
    from: Date;
    to: Date;
  }
) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfLastMonth(now);
  const lastMonthEnd = endOfLastMonth(now);

  const [
    monthSales,
    lastMonthSales,
    monthInvoices,
    lastMonthInvoices,
    documentGroups,
  ] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
        ...activeSaleStatusFilter(),
      },
    }),
    db.sale.findMany({
      where: {
        companyId,
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        ...activeSaleStatusFilter(),
      },
    }),
    db.invoice.findMany({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
        ...activeInvoiceStatusFilter(),
      },
    }),
    db.invoice.findMany({
      where: {
        companyId,
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        ...activeInvoiceStatusFilter(),
      },
    }),
    fetchDocuments(companyId),
  ]);

  const monthSalesTotal = sumTotal(monthSales);
  const lastMonthSalesTotal = sumTotal(lastMonthSales);

  const monthCollected = monthSales
    .filter((sale) => isActiveSaleStatus(sale.status))
    .reduce(
      (sum, sale) =>
        sum + getCollectedAmount(Number(sale.total), Number(sale.paidAmount)),
      0
    );

  const lastMonthCollected = lastMonthSales
    .filter((sale) => isActiveSaleStatus(sale.status))
    .reduce(
      (sum, sale) =>
        sum + getCollectedAmount(Number(sale.total), Number(sale.paidAmount)),
      0
    );

  const monthUncollected = monthSales
    .filter((sale) => isActiveSaleStatus(sale.status))
    .reduce(
      (sum, sale) =>
        sum + getSaleRemainingAmount(Number(sale.total), Number(sale.paidAmount)),
      0
    );

  const lastMonthUncollected = lastMonthSales
    .filter((sale) => isActiveSaleStatus(sale.status))
    .reduce(
      (sum, sale) =>
        sum + getSaleRemainingAmount(Number(sale.total), Number(sale.paidAmount)),
      0
    );

  const monthInvoiceCount = monthInvoices.length;
  const lastMonthInvoiceCount = lastMonthInvoices.length;

  const monthInvoiceTotal = sumTotal(monthInvoices);
  const lastMonthInvoiceTotal = sumTotal(lastMonthInvoices);

  const monthAverage =
    monthInvoiceCount > 0 ? monthInvoiceTotal / monthInvoiceCount : 0;
  const lastMonthAverage =
    lastMonthInvoiceCount > 0
      ? lastMonthInvoiceTotal / lastMonthInvoiceCount
      : 0;

  const salesChange = buildChangeLabel(monthSalesTotal, lastMonthSalesTotal);
  const collectedChange = buildChangeLabel(monthCollected, lastMonthCollected);
  const uncollectedChange = buildChangeLabel(
    monthUncollected,
    lastMonthUncollected,
    true
  );
  const invoiceCountChange = buildChangeLabel(
    monthInvoiceCount,
    lastMonthInvoiceCount
  );
  const averageChange = buildChangeLabel(monthAverage, lastMonthAverage);

  const statCards: SalesStatCard[] = [
    {
      title: "Bu Ay Toplam Satış",
      value: formatMoney(monthSalesTotal),
      subtitle: `Geçen Ay: ${formatMoney(lastMonthSalesTotal)}`,
      change: salesChange.change,
      positive: salesChange.positive,
      iconKey: "trending",
      color: "emerald",
    },
    {
      title: "Tahsil Edilen Tutar",
      value: formatMoney(monthCollected),
      subtitle: `Geçen Ay: ${formatMoney(lastMonthCollected)}`,
      change: collectedChange.change,
      positive: collectedChange.positive,
      iconKey: "check",
      color: "blue",
    },
    {
      title: "Tahsil Edilmeyen",
      value: formatMoney(monthUncollected),
      subtitle: `Geçen Ay: ${formatMoney(lastMonthUncollected)}`,
      change: uncollectedChange.change,
      positive: uncollectedChange.positive,
      iconKey: "wallet",
      color: "orange",
    },
    {
      title: "Toplam Fatura",
      value: String(monthInvoiceCount),
      subtitle: `Geçen Ay: ${lastMonthInvoiceCount}`,
      change: invoiceCountChange.change,
      positive: invoiceCountChange.positive,
      iconKey: "file",
      color: "violet",
    },
    {
      title: "Ortalama Fatura",
      value: formatMoney(monthAverage),
      subtitle: `Geçen Ay: ${formatMoney(lastMonthAverage)}`,
      change: averageChange.change,
      positive: averageChange.positive,
      iconKey: "calendar",
      color: "sky",
    },
  ];

  const tabRows = documentGroups[options.tab];
  const { from: rangeFrom, to: rangeTo } = normalizeDateRange(
    startOfDay(options.from),
    options.to
  );
  const filteredRows = filterByDateRange(tabRows, rangeFrom, rangeTo).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const totalRecords = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  return {
    statCards,
    rows: paginatedRows,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
    exportHref: buildSalesExportQuery({
      tab: options.tab,
      from: rangeFrom,
      to: rangeTo,
    }),
  };
}

export async function getSalesExportRows(
  companyId: string,
  options: {
    tab: SalesTabKey;
    from: Date;
    to: Date;
    saleId?: string | null;
    invoiceId?: string | null;
    collectionId?: string | null;
  }
) {
  if (options.saleId) {
    const sale = await db.sale.findFirst({
      where: { id: options.saleId, companyId },
      include: { customer: true, items: true, invoice: true },
    });

    if (!sale) return [];

    return [
      {
        documentNo: sale.saleNo,
        customerName: sale.customer?.name ?? "Müşteri seçilmedi",
        date: sale.createdAt,
        typeLabel: sale.status === "DRAFT" ? "Teklif" : "Satış",
        amount: Number(sale.total),
        paymentStatus: sale.paymentStatus,
        status: sale.status,
        itemSummary: sale.items
          .map((item) => `${item.name} x${item.quantity}`)
          .join(" | "),
      },
    ];
  }

  if (options.invoiceId) {
    const invoice = await db.invoice.findFirst({
      where: { id: options.invoiceId, companyId },
      include: { customer: true, sale: true },
    });

    if (!invoice) return [];

    return [
      {
        documentNo: invoice.invoiceNo,
        customerName: invoice.customer?.name ?? "Müşteri seçilmedi",
        date: invoice.createdAt,
        typeLabel: "Fatura",
        amount: Number(invoice.total),
        paymentStatus: invoice.paymentStatus,
        status: invoice.status,
        itemSummary: invoice.sale?.saleNo
          ? `Satış: ${invoice.sale.saleNo}`
          : "Bağımsız fatura",
      },
    ];
  }

  if (options.collectionId) {
    const tx = await db.accountTransaction.findFirst({
      where: {
        id: options.collectionId,
        type: "INCOME",
        account: { companyId },
      },
      include: { account: true },
    });

    if (!tx) return [];

    return [
      {
        documentNo: `THS-${tx.id.slice(-8).toUpperCase()}`,
        customerName: tx.title.replace(/^Tahsilat:\s*/i, "") || "Tahsilat",
        date: tx.date,
        typeLabel: "Tahsilat",
        amount: Number(tx.amount),
        paymentStatus: "PAID",
        status: "COMPLETED",
        itemSummary: tx.account.name,
      },
    ];
  }

  const documentGroups = await fetchDocuments(companyId);
  const tabRows = documentGroups[options.tab];
  const { from: rangeFrom, to: rangeTo } = normalizeDateRange(
    startOfDay(options.from),
    options.to
  );
  const filteredRows = filterByDateRange(tabRows, rangeFrom, rangeTo).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return filteredRows.map((row) => ({
    documentNo: row.documentNo,
    customerName: row.customerName,
    date: row.createdAt,
    typeLabel: row.typeLabel,
    amount: row.amount,
    paymentStatus: row.paymentStatus,
    status: row.saleStatus ?? "-",
    itemSummary: row.typeLabel,
  }));
}
