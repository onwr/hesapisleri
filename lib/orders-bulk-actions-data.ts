import { getBulkOrderList, parseBulkOrderFilters } from "@/lib/orders-bulk-actions-service";

export async function getOrderBulkActionsPageData(
  companyId: string,
  searchParams: {
    q?: string | null;
    channel?: string | null;
    orderStatus?: string | null;
    from?: string | null;
    to?: string | null;
    tab?: string | null;
  }
) {
  const filters = parseBulkOrderFilters(searchParams);
  const { rows, summary } = await getBulkOrderList(companyId, filters);

  return {
    filters,
    rows,
    summary,
  };
}
