import type { OrderSourceChannel, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { orderStatusesForTab } from "@/lib/order-utils";
import {
  buildChannelBreakdown,
  buildIntegrationActivities,
  buildOrderStatCards,
  buildOrdersExportQuery,
  buildOrdersQuery,
  endOfDay,
  mapSaleToOrderRow,
  type OrderActionCard,
  type OrderChannelBreakdown,
  type OrderIntegrationActivity,
  type OrderStatCard,
  type OrderTabKey,
  type OrderTableRow,
} from "@/lib/orders-page-utils";

export type {
  OrderActionCard,
  OrderChannelBreakdown,
  OrderIntegrationActivity,
  OrderStatCard,
  OrderTabKey,
  OrderTableRow,
} from "@/lib/orders-page-utils";

export {
  MARKETPLACE_INTEGRATIONS,
  ORDER_STATUS_CLASS,
  ORDER_TAB_LABELS,
  buildOrdersExportQuery,
  buildOrdersQuery,
  formatDateDisplay,
  formatDateInputValue,
  formatOrderDateTime,
  formatOrderMoney,
  normalizeDateRange,
  parseDateParam,
  parseOrderTab,
  parsePage,
  parseSearchQuery,
  parseSourceChannelFilter,
} from "@/lib/orders-page-utils";

const PAGE_SIZE = 10;

const saleListInclude = {
  customer: true,
  items: true,
} as const;

function buildActionCards(): OrderActionCard[] {
  return [
    {
      title: "Yeni Sipariş",
      description: "Yeni satış/sipariş oluştur",
      href: "/sales/new",
      iconKey: "plus",
      gradient: "from-emerald-500 to-green-600",
    },
    {
      title: "İade / Değişim",
      description: "İade ve iptal siparişleri",
      href: buildOrdersQuery({ tab: "returns" }),
      iconKey: "refresh",
      gradient: "from-blue-500 to-blue-600",
    },
    {
      title: "Kargo Oluştur",
      description: "Onaylanan siparişlere kargo bilgisi gir",
      href: buildOrdersQuery({ tab: "approved" }),
      iconKey: "truck",
      gradient: "from-orange-400 to-orange-600",
    },
    {
      title: "Sipariş Aktar",
      description: "CSV ile sipariş içe aktar",
      href: "/orders/import",
      iconKey: "spreadsheet",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Toplu İşlemler",
      description: "Durum ve kargo toplu güncelle",
      href: "/orders/bulk-actions",
      iconKey: "grid",
      gradient: "from-rose-400 to-pink-600",
    },
  ];
}

export type OrdersListFilters = {
  tab: OrderTabKey;
  page: number;
  from: Date;
  to: Date;
  q?: string | null;
  channel?: OrderSourceChannel | null;
};

function buildPeriodWhere(
  companyId: string,
  from: Date,
  to: Date
): Prisma.SaleWhereInput {
  return {
    companyId,
    createdAt: {
      gte: from,
      lte: endOfDay(to),
    },
  };
}

function buildListWhere(
  companyId: string,
  filters: OrdersListFilters
): Prisma.SaleWhereInput {
  const where: Prisma.SaleWhereInput = buildPeriodWhere(
    companyId,
    filters.from,
    filters.to
  );

  const statuses = orderStatusesForTab(filters.tab);
  if (statuses) {
    where.orderStatus = { in: statuses };
  }

  if (filters.channel) {
    where.sourceChannel = filters.channel;
  }

  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { saleNo: { contains: q, mode: "insensitive" } },
      { externalOrderId: { contains: q, mode: "insensitive" } },
      { trackingNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q, mode: "insensitive" } } },
    ];
  }

  return where;
}

async function getPeriodStats(companyId: string, from: Date, to: Date) {
  const grouped = await db.sale.groupBy({
    by: ["orderStatus"],
    where: buildPeriodWhere(companyId, from, to),
    _count: { _all: true },
    _sum: { total: true },
  });

  return grouped.map((item) => ({
    orderStatus: item.orderStatus,
    count: item._count._all,
    amount: Number(item._sum.total ?? 0),
  }));
}

async function getChannelCounts(companyId: string, from: Date, to: Date) {
  const grouped = await db.sale.groupBy({
    by: ["sourceChannel"],
    where: buildPeriodWhere(companyId, from, to),
    _count: { _all: true },
  });

  return grouped.map((item) => ({
    sourceChannel: item.sourceChannel,
    count: item._count._all,
  }));
}

async function getLatestByChannel(companyId: string, from: Date, to: Date) {
  const sales = await db.sale.findMany({
    where: buildPeriodWhere(companyId, from, to),
    select: {
      sourceChannel: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<
    OrderSourceChannel,
    { count: number; latestAt: Date }
  >();

  for (const sale of sales) {
    const existing = map.get(sale.sourceChannel);
    if (!existing) {
      map.set(sale.sourceChannel, {
        count: 1,
        latestAt: sale.createdAt,
      });
    } else {
      existing.count += 1;
    }
  }

  return Array.from(map.entries()).map(([sourceChannel, value]) => ({
    sourceChannel,
    ...value,
  }));
}

export async function getOrdersPageData(
  companyId: string,
  options: OrdersListFilters
) {
  const where = buildListWhere(companyId, options);

  const [totalRecords, sales, periodStats, channelCounts, latestByChannel] =
    await Promise.all([
      db.sale.count({ where }),
      db.sale.findMany({
        where,
        include: saleListInclude,
        orderBy: { createdAt: "desc" },
        skip: (options.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      getPeriodStats(companyId, options.from, options.to),
      getChannelCounts(companyId, options.from, options.to),
      getLatestByChannel(companyId, options.from, options.to),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const currentPage = Math.min(options.page, totalPages);
  const rows = sales.map((sale) => mapSaleToOrderRow(sale));

  const statCards = buildOrderStatCards(periodStats);
  const channelBreakdown = buildChannelBreakdown(channelCounts);
  const integrationActivities = buildIntegrationActivities(latestByChannel);

  const exportHref = buildOrdersExportQuery({
    tab: options.tab,
    from: options.from,
    to: options.to,
    q: options.q,
    channel: options.channel,
  });

  const integrationOrderCounts: Record<string, number> = {};
  for (const item of channelCounts) {
    integrationOrderCounts[item.sourceChannel] = item.count;
  }

  const periodOrderCount = periodStats.reduce(
    (sum, item) => sum + item.count,
    0
  );

  return {
    rows,
    statCards,
    actionCards: buildActionCards(),
    channelBreakdown,
    integrationActivities,
    periodOrderCount,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
    exportHref,
    integrationOrderCounts,
  };
}

export async function getOrdersExportRows(
  companyId: string,
  options: Omit<OrdersListFilters, "page">
) {
  const sales = await db.sale.findMany({
    where: buildListWhere(companyId, { ...options, page: 1 }),
    include: saleListInclude,
    orderBy: { createdAt: "desc" },
  });

  return sales.map((sale) => mapSaleToOrderRow(sale));
}

export async function getOrderDetailData(companyId: string, orderId: string) {
  const sale = await db.sale.findFirst({
    where: {
      id: orderId,
      companyId,
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          warehouse: true,
        },
      },
      warehouse: true,
      invoice: true,
      user: true,
    },
  });

  if (!sale) return null;

  const activities = await db.activityLog.findMany({
    where: {
      companyId,
      module: { in: ["orders", "sales", "pos"] },
      message: { contains: sale.saleNo },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: {
        select: { name: true },
      },
    },
  });

  return {
    sale,
    orderRow: mapSaleToOrderRow(sale),
    activities,
  };
}
