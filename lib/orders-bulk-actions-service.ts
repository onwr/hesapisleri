import type { OrderSourceChannel, OrderStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  mapOrderStatusToLabel,
  orderStatusesForTab,
  parseOrderTab,
  parseSearchQuery,
  parseSourceChannelFilter,
} from "@/lib/order-utils";
import { endOfDay, mapSaleToOrderRow } from "@/lib/orders-page-utils";
import { parseDateParam } from "@/lib/sales-page-utils";

export type OrderBulkStatusFilter = "all" | OrderStatus;

export type OrderBulkFilters = {
  q: string | null;
  channel: OrderSourceChannel | null;
  orderStatus: OrderBulkStatusFilter;
  from: Date | null;
  to: Date | null;
};

export type BulkOrderRow = {
  id: string;
  orderNo: string;
  saleNo: string;
  customerName: string;
  status: string;
  orderStatus: OrderStatus;
  channel: OrderSourceChannel;
  cargo: string;
  cargoCode: string | null;
  total: number;
  createdAt: Date;
};

export type BulkOrderListSummary = {
  totalCount: number;
  totalAmount: number;
  waitingCount: number;
  approvedCount: number;
  shippingCount: number;
};

export function parseBulkOrderStatus(
  value?: string | null
): OrderBulkStatusFilter {
  const statuses: OrderStatus[] = [
    "WAITING",
    "APPROVED",
    "SHIPPING",
    "DELIVERED",
    "RETURN_REQUESTED",
    "RETURNED",
    "CANCELLED",
  ];

  if (value && statuses.includes(value as OrderStatus)) {
    return value as OrderStatus;
  }

  return "all";
}

export function parseBulkOrderFilters(searchParams: {
  q?: string | null;
  channel?: string | null;
  orderStatus?: string | null;
  from?: string | null;
  to?: string | null;
  tab?: string | null;
}): OrderBulkFilters {
  const tabStatuses = orderStatusesForTab(parseOrderTab(searchParams.tab));

  return {
    q: parseSearchQuery(searchParams.q),
    channel: parseSourceChannelFilter(searchParams.channel),
    orderStatus:
      parseBulkOrderStatus(searchParams.orderStatus) !== "all"
        ? parseBulkOrderStatus(searchParams.orderStatus)
        : tabStatuses?.length === 1
          ? tabStatuses[0]!
          : "all",
    from: parseDateParam(searchParams.from),
    to: parseDateParam(searchParams.to),
  };
}

function buildBulkWhere(companyId: string, filters: OrderBulkFilters) {
  const where: {
    companyId: string;
    createdAt?: { gte?: Date; lte?: Date };
    sourceChannel?: OrderSourceChannel;
    orderStatus?: OrderStatus | { in: OrderStatus[] };
    OR?: Array<Record<string, unknown>>;
  } = { companyId };

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = endOfDay(filters.to);
  }

  if (filters.channel) {
    where.sourceChannel = filters.channel;
  }

  if (filters.orderStatus !== "all") {
    where.orderStatus = filters.orderStatus;
  }

  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { saleNo: { contains: q, mode: "insensitive" } },
      { externalOrderId: { contains: q, mode: "insensitive" } },
      { trackingNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function getBulkOrderList(
  companyId: string,
  filters: OrderBulkFilters
) {
  const where = buildBulkWhere(companyId, filters);

  const sales = await db.sale.findMany({
    where,
    include: {
      customer: true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const rows: BulkOrderRow[] = sales.map((sale) => {
    const mapped = mapSaleToOrderRow(sale);
    return {
      id: mapped.id,
      orderNo: mapped.orderNo,
      saleNo: mapped.saleNo,
      customerName: mapped.customerName,
      status: mapped.status,
      orderStatus: mapped.orderStatus,
      channel: mapped.channel,
      cargo: mapped.cargo,
      cargoCode: mapped.cargoCode,
      total: mapped.total,
      createdAt: mapped.createdAt,
    };
  });

  const summary: BulkOrderListSummary = {
    totalCount: rows.length,
    totalAmount: rows.reduce((sum, row) => sum + row.total, 0),
    waitingCount: rows.filter((row) => row.orderStatus === "WAITING").length,
    approvedCount: rows.filter((row) => row.orderStatus === "APPROVED").length,
    shippingCount: rows.filter((row) => row.orderStatus === "SHIPPING").length,
  };

  return { rows, summary };
}

export async function getBulkOrderExportRows(
  companyId: string,
  ids: string[]
) {
  const sales = await db.sale.findMany({
    where: {
      companyId,
      id: { in: ids },
    },
    include: {
      customer: true,
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return sales.map((sale) => mapSaleToOrderRow(sale));
}

export function summarizeBulkOrderSelection(
  rows: BulkOrderRow[],
  selectedIds: string[]
) {
  const selected = rows.filter((row) => selectedIds.includes(row.id));

  return {
    selectedCount: selected.length,
    selectedAmount: selected.reduce((sum, row) => sum + row.total, 0),
    approvedCount: selected.filter((row) => row.orderStatus === "APPROVED")
      .length,
    waitingCount: selected.filter((row) => row.orderStatus === "WAITING")
      .length,
  };
}

export { mapOrderStatusToLabel };
