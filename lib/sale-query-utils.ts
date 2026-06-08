export const CANCELLED_SALE_STATUSES = ["CANCELLED", "REFUNDED"] as const;

export const QUOTE_SALE_STATUS = "DRAFT" as const;

export const CANCELLED_INVOICE_STATUSES = ["CANCELLED"] as const;

export function isQuoteSaleStatus(status: string) {
  return status === QUOTE_SALE_STATUS;
}

export function isCompletedSaleStatus(status: string) {
  return status === "COMPLETED";
}

export function isActiveSaleStatus(status: string) {
  if (isQuoteSaleStatus(status)) {
    return false;
  }

  return !CANCELLED_SALE_STATUSES.includes(
    status as (typeof CANCELLED_SALE_STATUSES)[number]
  );
}

export function isActiveInvoiceStatus(status: string) {
  return !CANCELLED_INVOICE_STATUSES.includes(
    status as (typeof CANCELLED_INVOICE_STATUSES)[number]
  );
}

export function activeSaleStatusFilter() {
  return {
    status: {
      notIn: [...CANCELLED_SALE_STATUSES, QUOTE_SALE_STATUS],
    },
  };
}

export function completedSaleStatusFilter() {
  return {
    status: "COMPLETED" as const,
  };
}

export function activeInvoiceStatusFilter() {
  return {
    status: {
      notIn: [...CANCELLED_INVOICE_STATUSES],
    },
  };
}
