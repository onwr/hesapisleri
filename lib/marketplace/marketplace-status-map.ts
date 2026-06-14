import type { OrderStatus } from "@prisma/client";

const TRENDYOL_STATUS_MAP: Record<string, OrderStatus> = {
  CREATED: "WAITING",
  PICKING: "WAITING",
  INVOICED: "APPROVED",
  SHIPPED: "SHIPPING",
  ATCOLLECTIONPOINT: "SHIPPING",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  UNSUPPLIED: "CANCELLED",
  RETURNED: "RETURNED",
  RETURNREQUESTED: "RETURN_REQUESTED",
  UNPACKED: "RETURN_REQUESTED",
};

const HEPSIBURADA_STATUS_MAP: Record<string, OrderStatus> = {
  OPEN: "WAITING",
  NEW: "WAITING",
  PAYMENTAWAITING: "WAITING",
  AWAITINGPAYMENT: "WAITING",
  PACKAGED: "APPROVED",
  READYTOSHIP: "APPROVED",
  PREPARING: "APPROVED",
  PICKING: "APPROVED",
  SHIPPED: "SHIPPING",
  INCARGO: "SHIPPING",
  CARGO: "SHIPPING",
  INTRANSIT: "SHIPPING",
  DELIVERED: "DELIVERED",
  COMPLETED: "DELIVERED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  RETURNED: "RETURNED",
  RETURN: "RETURNED",
  RETURNCOMPLETED: "RETURNED",
  RETURNREQUESTED: "RETURN_REQUESTED",
  CLAIM: "RETURN_REQUESTED",
  NEWREQUEST: "RETURN_REQUESTED",
};

function normalizeStatusKey(value: string) {
  return value.replace(/[\s_-]/g, "").toUpperCase();
}

export function mapTrendyolStatusToOrderStatus(value: string): OrderStatus {
  return TRENDYOL_STATUS_MAP[normalizeStatusKey(value)] ?? "WAITING";
}

export function mapHepsiburadaStatusToOrderStatus(value: string): OrderStatus {
  return HEPSIBURADA_STATUS_MAP[normalizeStatusKey(value)] ?? "WAITING";
}
