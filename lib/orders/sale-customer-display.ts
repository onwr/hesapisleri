import type { OrderSourceChannel } from "@prisma/client";

const MARKETPLACE_BUCKET_CUSTOMER_NAMES = new Set([
  "Trendyol Müşterileri",
  "Hepsiburada Müşterileri",
]);

const MARKETPLACE_CHANNELS = new Set<OrderSourceChannel>([
  "TRENDYOL",
  "HEPSIBURADA",
]);

export function isMarketplaceSourceChannel(channel: OrderSourceChannel) {
  return MARKETPLACE_CHANNELS.has(channel);
}

export function isMarketplaceBucketCustomerName(name: string | null | undefined) {
  if (!name) return false;
  return MARKETPLACE_BUCKET_CUSTOMER_NAMES.has(name.trim());
}

export function extractMarketplaceBuyerFromOrderNote(
  orderNote: string | null | undefined
) {
  if (!orderNote) return null;
  const match = orderNote.match(/Alıcı:\s*([^.\n]+)/i);
  const buyer = match?.[1]?.trim();
  return buyer || null;
}

export function resolveSaleCustomerDisplay(input: {
  sourceChannel: OrderSourceChannel;
  externalOrderId: string | null;
  orderNote?: string | null;
  customer: { name: string; phone: string | null } | null;
}) {
  if (
    input.customer &&
    !isMarketplaceBucketCustomerName(input.customer.name)
  ) {
    return {
      customerName: input.customer.name,
      customerSubName: input.customer.phone,
      localCustomerMatched: true as const,
    };
  }

  if (isMarketplaceSourceChannel(input.sourceChannel)) {
    const buyer = extractMarketplaceBuyerFromOrderNote(input.orderNote);
    if (buyer) {
      return {
        customerName: buyer,
        customerSubName: input.externalOrderId
          ? `Pazaryeri #${input.externalOrderId}`
          : null,
        localCustomerMatched: false as const,
      };
    }

    const channelLabel =
      input.sourceChannel === "TRENDYOL" ? "Trendyol" : "Hepsiburada";
    return {
      customerName: `${channelLabel} alıcısı`,
      customerSubName: input.externalOrderId
        ? `Sipariş ${input.externalOrderId} · Yerel cari ile eşleşmedi`
        : "Yerel cari ile eşleşmedi",
      localCustomerMatched: false as const,
    };
  }

  if (!input.customer) {
    return {
      customerName: "Müşteri seçilmedi",
      customerSubName: null,
      localCustomerMatched: false as const,
    };
  }

  return {
    customerName: input.customer.name,
    customerSubName: input.customer.phone,
    localCustomerMatched: true as const,
  };
}
