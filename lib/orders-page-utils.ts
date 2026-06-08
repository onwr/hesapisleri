import type { OrderSourceChannel, OrderStatus, PaymentStatus } from "@prisma/client";
import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";
import { startOfDay } from "@/lib/dashboard-metrics";
import {
  getChannelColor,
  getMarketplaceName,
  MARKETPLACE_INTEGRATIONS,
} from "@/lib/marketplace-logos";
import {
  formatOrderNo,
  getSourceChannelLabel,
  mapOrderStatusToLabel,
  ORDER_STATUS_CLASS,
  ORDER_TAB_LABELS,
  parseOrderTab,
  parsePage,
  parseSearchQuery,
  parseSourceChannelFilter,
  type OrderStatusLabel,
  type OrderTabKey,
} from "@/lib/order-utils";

export type { OrderStatusLabel, OrderTabKey } from "@/lib/order-utils";

export type OrderTableRow = {
  id: string;
  orderNo: string;
  saleNo: string;
  customerName: string;
  customerSubName: string | null;
  itemCount: number;
  total: number;
  status: OrderStatusLabel;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: OrderSourceChannel;
  externalOrderId: string | null;
  cargo: string;
  cargoCode: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  detailHref: string;
};

export type OrderStatCard = {
  title: string;
  count: number;
  amount: number;
  iconKey: "bag" | "refresh" | "check" | "truck" | "package" | "alert";
  color: "emerald" | "orange" | "blue" | "rose";
  tab: OrderTabKey;
};

export type OrderChannelBreakdown = {
  key: OrderSourceChannel;
  name: string;
  count: number;
  percent: number;
  color: string;
  logo: string;
};

export type OrderIntegrationActivity = {
  key: OrderSourceChannel;
  name: string;
  description: string;
  timeLabel: string;
  logo: string;
};

export type OrderActionCard = {
  title: string;
  description: string;
  href: string;
  iconKey: "plus" | "refresh" | "truck" | "spreadsheet" | "grid";
  gradient: string;
};

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export { formatMoney as formatOrderMoney } from "@/lib/format-utils";

export function formatOrderDateTime(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeActivityTime(date: Date, now = new Date()) {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Az önce";
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;

  return formatOrderDateTime(date);
}

export function mapSaleToOrderRow(sale: {
  id: string;
  saleNo: string;
  total: unknown;
  paymentStatus: PaymentStatus;
  sourceChannel: OrderSourceChannel;
  externalOrderId: string | null;
  orderStatus: OrderStatus;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  customer: { name: string; phone: string | null } | null;
  items: Array<unknown>;
}): OrderTableRow {
  const cargo = sale.shippingCarrier?.trim() || "—";
  const cargoCode = sale.trackingNumber?.trim() || null;

  return {
    id: sale.id,
    orderNo: formatOrderNo(sale.saleNo),
    saleNo: sale.saleNo,
    customerName: sale.customer?.name ?? "Müşteri seçilmedi",
    customerSubName: sale.customer?.phone ?? null,
    itemCount: sale.items.length,
    total: Number(sale.total),
    status: mapOrderStatusToLabel(sale.orderStatus),
    orderStatus: sale.orderStatus,
    paymentStatus: sale.paymentStatus,
    channel: sale.sourceChannel,
    externalOrderId: sale.externalOrderId,
    cargo,
    cargoCode,
    shippedAt: sale.shippedAt,
    deliveredAt: sale.deliveredAt,
    createdAt: sale.createdAt,
    detailHref: `/orders/${sale.id}`,
  };
}

export function buildOrderStatCards(
  stats: Array<{ orderStatus: OrderStatus; count: number; amount: number }>
): OrderStatCard[] {
  const byStatus = new Map(stats.map((item) => [item.orderStatus, item]));

  const get = (status: OrderStatus) =>
    byStatus.get(status) ?? { orderStatus: status, count: 0, amount: 0 };

  const waiting = get("WAITING");
  const approved = get("APPROVED");
  const shipping = get("SHIPPING");
  const delivered = get("DELIVERED");
  const returnRequested = get("RETURN_REQUESTED");
  const returned = get("RETURNED");
  const cancelled = get("CANCELLED");

  const totalCount =
    waiting.count +
    approved.count +
    shipping.count +
    delivered.count +
    returnRequested.count +
    returned.count +
    cancelled.count;
  const totalAmount =
    waiting.amount +
    approved.amount +
    shipping.amount +
    delivered.amount +
    returnRequested.amount +
    returned.amount +
    cancelled.amount;

  const returnsCount =
    returnRequested.count + returned.count + cancelled.count;
  const returnsAmount =
    returnRequested.amount + returned.amount + cancelled.amount;

  return [
    {
      title: "Toplam Sipariş",
      count: totalCount,
      amount: totalAmount,
      iconKey: "bag",
      color: "emerald",
      tab: "all",
    },
    {
      title: "Beklemede",
      count: waiting.count,
      amount: waiting.amount,
      iconKey: "refresh",
      color: "orange",
      tab: "waiting",
    },
    {
      title: "Onaylandı",
      count: approved.count,
      amount: approved.amount,
      iconKey: "check",
      color: "emerald",
      tab: "approved",
    },
    {
      title: "Kargoda",
      count: shipping.count,
      amount: shipping.amount,
      iconKey: "truck",
      color: "blue",
      tab: "shipping",
    },
    {
      title: "Teslim Edildi",
      count: delivered.count,
      amount: delivered.amount,
      iconKey: "package",
      color: "emerald",
      tab: "delivered",
    },
    {
      title: "İade / İptal",
      count: returnsCount,
      amount: returnsAmount,
      iconKey: "alert",
      color: "rose",
      tab: "returns",
    },
  ];
}

export function buildChannelBreakdown(
  counts: Array<{ sourceChannel: OrderSourceChannel; count: number }>
): OrderChannelBreakdown[] {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const countMap = new Map(
    counts.map((item) => [item.sourceChannel, item.count])
  );

  const rows: OrderChannelBreakdown[] = [];

  for (const integration of MARKETPLACE_INTEGRATIONS) {
    const count = countMap.get(integration.key) ?? 0;
    if (count > 0) {
      rows.push({
        key: integration.key,
        name: integration.name,
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        color: integration.color,
        logo: integration.logo,
      });
    }
  }

  const otherChannels: OrderSourceChannel[] = [
    "MANUAL",
    "POS",
    "WEBSITE",
    "OTHER",
  ];

  for (const channel of otherChannels) {
    const count = countMap.get(channel) ?? 0;
    if (count > 0) {
      rows.push({
        key: channel,
        name: getSourceChannelLabel(channel),
        count,
        percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        color: getChannelColor(channel),
        logo: "",
      });
    }
  }

  return rows.sort((a, b) => b.count - a.count);
}

export function buildIntegrationActivities(
  latestByChannel: Array<{
    sourceChannel: OrderSourceChannel;
    count: number;
    latestAt: Date;
  }>,
  now = new Date()
): OrderIntegrationActivity[] {
  return MARKETPLACE_INTEGRATIONS.map((integration) => {
    const row = latestByChannel.find(
      (item) => item.sourceChannel === integration.key
    );

    return {
      key: integration.key,
      name: integration.name,
      description: row ? `${row.count} sipariş` : "Henüz sipariş yok",
      timeLabel: row ? formatRelativeActivityTime(row.latestAt, now) : "—",
      logo: integration.logo,
    };
  }).filter((item) => item.description !== "Henüz sipariş yok");
}

export function buildOrdersQuery(params: {
  tab?: OrderTabKey;
  page?: number;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
  channel?: OrderSourceChannel | null;
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

  if (params.channel) {
    search.set("channel", params.channel);
  }

  const query = search.toString();
  return query ? `/orders?${query}` : "/orders";
}

export function buildOrdersExportQuery(params: {
  tab?: OrderTabKey;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
  channel?: OrderSourceChannel | null;
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

  if (params.channel) {
    search.set("channel", params.channel);
  }

  const query = search.toString();
  return query ? `/api/orders/export?${query}` : "/api/orders/export";
}

export {
  formatDateDisplay,
  formatDateInputValue,
  getMarketplaceName,
  MARKETPLACE_INTEGRATIONS,
  normalizeDateRange,
  ORDER_STATUS_CLASS,
  ORDER_TAB_LABELS,
  parseDateParam,
  parseOrderTab,
  parsePage,
  parseSearchQuery,
  parseSourceChannelFilter,
};
