export type SalesTabKey = "all" | "invoices" | "collections" | "offers" | "returns";

export type SalesDocumentSource = "sale" | "invoice" | "collection";

export type SalesDocumentRow = {
  id: string;
  createdAt: Date;
  documentNo: string;
  customerName: string;
  typeLabel: string;
  typeBadgeClass: string;
  amount: number;
  paymentStatus: string;
  saleStatus: string | null;
  detailHref: string;
  pdfUrl: string | null;
  sourceType: SalesDocumentSource;
  sourceId: string;
  saleId: string | null;
  invoiceId: string | null;
  canCancel: boolean;
  canCreateInvoice: boolean;
  canCollect: boolean;
  canConvert: boolean;
  isQuote: boolean;
  downloadHref: string | null;
};

export type SalesRowActionData = {
  id: string;
  documentNo: string;
  detailHref: string;
  sourceType: SalesDocumentSource;
  sourceId: string;
  saleId: string | null;
  invoiceId: string | null;
  paymentStatus: string;
  saleStatus: string | null;
  pdfUrl: string | null;
  downloadHref: string | null;
  canCancel: boolean;
  canCreateInvoice: boolean;
  canCollect: boolean;
  canConvert: boolean;
  isQuote: boolean;
};

export type SalesStatCard = {
  title: string;
  value: string;
  subtitle: string;
  change: string;
  positive: boolean;
  iconKey: "trending" | "check" | "wallet" | "file" | "calendar";
  color: "emerald" | "blue" | "orange" | "violet" | "sky";
};

export const SALES_TAB_LABELS: Record<SalesTabKey, string> = {
  all: "Tümü",
  invoices: "Faturalar",
  collections: "Tahsilatlar",
  offers: "Teklifler",
  returns: "İadeler",
};

export function parseSalesTab(value?: string | null): SalesTabKey {
  if (
    value === "invoices" ||
    value === "collections" ||
    value === "offers" ||
    value === "returns"
  ) {
    return value;
  }

  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseDateParam(value?: string | null) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatShortDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeDateRange(from: Date, to: Date) {
  const fromValue = formatDateInputValue(from);
  const toValue = formatDateInputValue(to);

  if (fromValue <= toValue) {
    return { from, to };
  }

  return {
    from: parseDateParam(toValue)!,
    to: parseDateParam(fromValue)!,
  };
}

export function buildSalesQuery(params: {
  tab?: SalesTabKey;
  page?: number;
  from?: Date | string;
  to?: Date | string;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  const query = search.toString();
  return query ? `/sales?${query}` : "/sales";
}

export function buildSalesExportQuery(params: {
  tab?: SalesTabKey;
  from?: Date | string;
  to?: Date | string;
  saleId?: string | null;
  invoiceId?: string | null;
  collectionId?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.saleId) {
    search.set("saleId", params.saleId);
  }

  if (params.invoiceId) {
    search.set("invoiceId", params.invoiceId);
  }

  if (params.collectionId) {
    search.set("collectionId", params.collectionId);
  }

  const query = search.toString();
  return query ? `/api/sales/export?${query}` : "/api/sales/export";
}

export function toSalesRowActionData(row: SalesDocumentRow): SalesRowActionData {
  return {
    id: row.id,
    documentNo: row.documentNo,
    detailHref: row.detailHref,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    saleId: row.saleId,
    invoiceId: row.invoiceId,
    paymentStatus: row.paymentStatus,
    saleStatus: row.saleStatus,
    pdfUrl: row.pdfUrl,
    downloadHref: row.downloadHref,
    canCancel: row.canCancel,
    canCreateInvoice: row.canCreateInvoice,
    canCollect: row.canCollect,
    canConvert: row.canConvert,
    isQuote: row.isQuote,
  };
}
