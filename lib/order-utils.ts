import type { OrderSourceChannel, OrderStatus, PaymentStatus } from "@prisma/client";

export type OrderTabKey =
  | "all"
  | "waiting"
  | "matching"
  | "approved"
  | "shipping"
  | "delivered"
  | "returns";

export type OrderStatusLabel =
  | "Beklemede"
  | "Onaylandı"
  | "Kargoda"
  | "Teslim Edildi"
  | "İade Talebi"
  | "İade Edildi"
  | "İptal Edildi";

export const ORDER_TAB_LABELS: Record<OrderTabKey, string> = {
  all: "Tüm Siparişler",
  waiting: "Beklemede",
  matching: "Eşleşme Bekleyenler",
  approved: "Onaylandı",
  shipping: "Kargoda",
  delivered: "Teslim Edildi",
  returns: "İade / İptal",
};

export const ORDER_STATUS_CLASS: Record<OrderStatusLabel, string> = {
  Beklemede: "bg-orange-100 text-orange-700",
  Onaylandı: "bg-emerald-100 text-emerald-700",
  Kargoda: "bg-blue-100 text-blue-700",
  "Teslim Edildi": "bg-emerald-100 text-emerald-700",
  "İade Talebi": "bg-rose-100 text-rose-700",
  "İade Edildi": "bg-rose-100 text-rose-700",
  "İptal Edildi": "bg-slate-100 text-slate-600",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Ödendi",
  UNPAID: "Ödenmedi",
  PARTIAL: "Kısmi Ödendi",
  FAILED: "Başarısız",
};

export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  UNPAID: "bg-slate-100 text-slate-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  FAILED: "bg-rose-100 text-rose-700",
};

export const MARKETPLACE_CHANNELS: OrderSourceChannel[] = [
  "TRENDYOL",
  "HEPSIBURADA",
  "N11",
  "AMAZON",
  "CICEKSEPETI",
  "ETSY",
];

export const SOURCE_CHANNEL_LABELS: Record<OrderSourceChannel, string> = {
  MANUAL: "Manuel Satış",
  POS: "POS",
  WEBSITE: "Web Sitesi",
  TRENDYOL: "Trendyol",
  HEPSIBURADA: "Hepsiburada",
  N11: "N11",
  AMAZON: "Amazon",
  CICEKSEPETI: "ÇiçekSepeti",
  ETSY: "Etsy",
  OTHER: "Diğer",
};

const TAB_STATUS_MAP: Record<Exclude<OrderTabKey, "all">, OrderStatus[]> = {
  waiting: ["WAITING"],
  matching: ["WAITING"],
  approved: ["APPROVED"],
  shipping: ["SHIPPING"],
  delivered: ["DELIVERED"],
  returns: ["RETURN_REQUESTED", "RETURNED", "CANCELLED"],
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  WAITING: ["APPROVED", "CANCELLED"],
  APPROVED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED", "RETURNED"],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

export function parseOrderTab(value?: string | null): OrderTabKey {
  if (
    value === "waiting" ||
    value === "matching" ||
    value === "approved" ||
    value === "shipping" ||
    value === "delivered" ||
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

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseSourceChannelFilter(
  value?: string | null
): OrderSourceChannel | null {
  if (!value) return null;
  if (value in SOURCE_CHANNEL_LABELS) {
    return value as OrderSourceChannel;
  }
  return null;
}

export function orderStatusesForTab(tab: OrderTabKey): OrderStatus[] | null {
  if (tab === "all") return null;
  return TAB_STATUS_MAP[tab];
}

export function formatOrderNo(saleNo: string) {
  return saleNo.replace(/^S-/, "SIP-").replace(/^TKL-/, "SIP-");
}

export function mapOrderStatusToLabel(status: OrderStatus): OrderStatusLabel {
  switch (status) {
    case "WAITING":
      return "Beklemede";
    case "APPROVED":
      return "Onaylandı";
    case "SHIPPING":
      return "Kargoda";
    case "DELIVERED":
      return "Teslim Edildi";
    case "RETURN_REQUESTED":
      return "İade Talebi";
    case "RETURNED":
      return "İade Edildi";
    case "CANCELLED":
      return "İptal Edildi";
    default:
      return "Beklemede";
  }
}

export function getSourceChannelLabel(channel: OrderSourceChannel) {
  return SOURCE_CHANNEL_LABELS[channel] ?? channel;
}

export function isMarketplaceChannel(channel: OrderSourceChannel) {
  return MARKETPLACE_CHANNELS.includes(channel);
}

export function canTransitionOrderStatus(
  current: OrderStatus,
  next: OrderStatus
) {
  if (current === next) return true;
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[current];
}

export function validateShippingFields(input: {
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
}) {
  const carrier = input.shippingCarrier?.trim();
  const tracking = input.trackingNumber?.trim();

  if (!carrier) {
    return { ok: false as const, message: "Kargo firması zorunludur." };
  }

  if (!tracking) {
    return { ok: false as const, message: "Takip numarası zorunludur." };
  }

  return {
    ok: true as const,
    shippingCarrier: carrier,
    trackingNumber: tracking,
  };
}
