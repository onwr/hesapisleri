import type { OrderSourceChannel } from "@prisma/client";
import { formatDateInputValue } from "@/lib/sales-page-utils";
import type { OrderBulkFilters } from "@/lib/orders-bulk-actions-service";

export function buildBulkActionsPageQuery(filters: Partial<OrderBulkFilters>) {
  const search = new URLSearchParams();

  if (filters.q) search.set("q", filters.q);
  if (filters.channel) search.set("channel", filters.channel);
  if (filters.orderStatus && filters.orderStatus !== "all") {
    search.set("orderStatus", filters.orderStatus);
  }
  if (filters.from) search.set("from", formatDateInputValue(filters.from));
  if (filters.to) search.set("to", formatDateInputValue(filters.to));

  const query = search.toString();
  return query ? `/orders/bulk-actions?${query}` : "/orders/bulk-actions";
}

export function buildBulkOrderListQuery(filters: Partial<OrderBulkFilters>) {
  const search = new URLSearchParams();

  if (filters.q) search.set("q", filters.q);
  if (filters.channel) search.set("channel", filters.channel);
  if (filters.orderStatus && filters.orderStatus !== "all") {
    search.set("orderStatus", filters.orderStatus);
  }
  if (filters.from) search.set("from", formatDateInputValue(filters.from));
  if (filters.to) search.set("to", formatDateInputValue(filters.to));

  const query = search.toString();
  return query ? `/api/orders/bulk-list?${query}` : "/api/orders/bulk-list";
}

export function buildBulkOrderExportHref(ids: string[]) {
  const search = new URLSearchParams();
  search.set("ids", ids.join(","));
  return `/api/orders/bulk-export?${search.toString()}`;
}

export const ORDER_CHANNEL_OPTIONS: Array<{
  value: OrderSourceChannel | "all";
  label: string;
}> = [
  { value: "all", label: "Tüm Kanallar" },
  { value: "MANUAL", label: "Manuel Satış" },
  { value: "POS", label: "POS" },
  { value: "WEBSITE", label: "Web Sitesi" },
  { value: "TRENDYOL", label: "Trendyol" },
  { value: "HEPSIBURADA", label: "Hepsiburada" },
  { value: "N11", label: "N11" },
  { value: "AMAZON", label: "Amazon" },
  { value: "CICEKSEPETI", label: "ÇiçekSepeti" },
  { value: "ETSY", label: "Etsy" },
  { value: "OTHER", label: "Diğer" },
];
