import type { ExpenseBulkFilters } from "@/lib/expense-bulk-actions-service";
import { formatDateInputValue } from "@/lib/sales-page-utils";

export function buildBulkExpenseListQuery(filters: ExpenseBulkFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.paymentStatus !== "all") {
    params.set("paymentStatus", filters.paymentStatus);
  }
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", formatDateInputValue(filters.from));
  if (filters.to) params.set("to", formatDateInputValue(filters.to));

  const query = params.toString();
  return query ? `/api/expenses/bulk-list?${query}` : "/api/expenses/bulk-list";
}

export function buildBulkExpenseExportHref(options: {
  ids?: string[];
  filters?: ExpenseBulkFilters;
}) {
  const params = new URLSearchParams();

  if (options.ids && options.ids.length > 0) {
    params.set("ids", options.ids.join(","));
  } else if (options.filters) {
    if (options.filters.q) params.set("q", options.filters.q);
    if (options.filters.category) {
      params.set("category", options.filters.category);
    }
    if (options.filters.paymentStatus !== "all") {
      params.set("paymentStatus", options.filters.paymentStatus);
    }
    if (options.filters.status !== "all") {
      params.set("status", options.filters.status);
    }
    if (options.filters.from) {
      params.set("from", formatDateInputValue(options.filters.from));
    }
    if (options.filters.to) {
      params.set("to", formatDateInputValue(options.filters.to));
    }
  }

  const query = params.toString();
  return query
    ? `/api/expenses/bulk-export?${query}`
    : "/api/expenses/bulk-export";
}

export function buildBulkActionsPageQuery(filters: ExpenseBulkFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.paymentStatus !== "all") {
    params.set("paymentStatus", filters.paymentStatus);
  }
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", formatDateInputValue(filters.from));
  if (filters.to) params.set("to", formatDateInputValue(filters.to));

  const query = params.toString();
  return query ? `/expenses/bulk-actions?${query}` : "/expenses/bulk-actions";
}
