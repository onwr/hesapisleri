import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";

export type ExpenseTabKey = "all" | "paid" | "unpaid" | "cancelled";

export type ExpenseTableRow = {
  id: string;
  date: Date;
  title: string;
  note: string | null;
  categoryName: string;
  supplier: string | null;
  documentNo: string;
  amount: number;
  status: string;
  paymentStatus: string;
};

export type ExpenseStatCard = {
  title: string;
  value: string;
  subtitle: string;
  change?: string;
  positive?: boolean;
  iconKey: "receipt" | "file" | "trending" | "wallet" | "hourglass";
  color: "blue" | "rose" | "orange" | "violet";
};

export type ExpenseCategoryBreakdown = {
  category: string;
  total: number;
  percent: number;
  color: string;
};

export const EXPENSE_TAB_LABELS: Record<ExpenseTabKey, string> = {
  all: "Tümü",
  paid: "Ödenmiş",
  unpaid: "Ödenmemiş",
  cancelled: "İptal",
};

export const EXPENSE_CHART_COLORS = [
  "#7c3aed",
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#94a3b8",
  "#06b6d4",
  "#ec4899",
];

export function parseExpenseTab(value?: string | null): ExpenseTabKey {
  if (value === "paid" || value === "unpaid" || value === "cancelled") {
    return value;
  }

  return "all";
}

export function parseExpenseCategoryFilter(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export { formatMoney as formatExpenseMoney } from "@/lib/format-utils";

export function formatExpenseDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getExpenseHaystack(expense: {
  title: string;
  category?: string | null;
  note?: string | null;
  supplier?: string | null;
}) {
  return [expense.title, expense.category, expense.note, expense.supplier]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

export function getExpenseDocumentNo(expense: { id: string; date: Date }) {
  const year = expense.date.getFullYear();
  return `GIS-${year}-${expense.id.slice(-6).toUpperCase()}`;
}

export function getCategoryBadge(category?: string | null) {
  const value = category || "Diğer";
  const normalized = value.toLocaleLowerCase("tr-TR");

  if (normalized.includes("kira")) return "bg-violet-50 text-violet-600";
  if (normalized.includes("fatura")) return "bg-blue-50 text-blue-600";
  if (normalized.includes("ulaşım") || normalized.includes("ulasim")) {
    return "bg-emerald-50 text-emerald-600";
  }
  if (normalized.includes("ofis")) return "bg-orange-50 text-orange-600";
  if (normalized.includes("yemek")) return "bg-rose-50 text-rose-600";
  if (normalized.includes("danışman") || normalized.includes("danisman")) {
    return "bg-purple-50 text-purple-600";
  }
  if (normalized.includes("reklam")) return "bg-sky-50 text-sky-600";
  if (normalized.includes("bakım") || normalized.includes("bakim")) {
    return "bg-cyan-50 text-cyan-600";
  }

  return "bg-slate-100 text-slate-600";
}

export function getCategoryIconStyle(category?: string | null) {
  return getCategoryBadge(category);
}

export function getExpenseStatusBadge(status: string) {
  if (status === "PENDING") {
    return {
      label: "Onay Bekliyor",
      className: "bg-orange-100 text-orange-700",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "İptal",
      className: "bg-slate-100 text-slate-600",
    };
  }

  return {
    label: "Onaylandı",
    className: "bg-emerald-100 text-emerald-700",
  };
}

export function buildConicGradient(
  segments: Array<{ color: string; percent: number }>
) {
  if (segments.length === 0) {
    return "conic-gradient(#e2e8f0 0 100%)";
  }

  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    cursor += segment.percent;
    return `${segment.color} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

export function buildExpensesQuery(params: {
  tab?: ExpenseTabKey;
  page?: number;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
  category?: string | null;
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

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.category) {
    search.set("category", params.category);
  }

  const query = search.toString();
  return query ? `/expenses?${query}` : "/expenses";
}

export function buildExpensesExportQuery(params: {
  tab?: ExpenseTabKey;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
  category?: string | null;
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

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.category) {
    search.set("category", params.category);
  }

  const query = search.toString();
  return query ? `/api/expenses/export?${query}` : "/api/expenses/export";
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
