import type { OrderStatus } from "@prisma/client";

export type MarketplaceChannelKey = "TRENDYOL" | "HEPSIBURADA";
export type MarketplaceChannel = MarketplaceChannelKey;

export type ShipmentPushInput = {
  externalOrderId: string;
  externalPackageId?: string;
  trackingNumber: string;
  shippingCarrier: string;
  shippedAt?: Date;
};

export type NormalizedMarketplaceOrder = {
  externalOrderId: string;
  externalPackageId?: string;
  channel: MarketplaceChannel;
  createdAt: Date;
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  items: Array<{
    merchantSku: string;
    barcode?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    lineId?: string;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
  };
  externalStatus: string;
  orderStatus: OrderStatus;
  shipping?: {
    carrier?: string;
    trackingNumber?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
  rawPayload?: unknown;
};

export type MarketplaceConnectionResult = {
  ok: boolean;
  message: string;
};

export type MarketplaceFetchOrdersResult = {
  orders: NormalizedMarketplaceOrder[];
  nextCursor?: string;
  errors?: Array<{
    message: string;
    page?: number;
    externalOrderId?: string;
    merchantSku?: string;
    rawStatus?: string;
  }>;
};

export type NormalizedMarketplaceListing = {
  externalListingId?: string;
  merchantSku: string;
  barcode?: string | null;
  title?: string | null;
  price?: number | null;
  stockQuantity?: number | null;
  raw?: unknown;
};

export type MarketplaceFetchListingsResult = {
  listings: NormalizedMarketplaceListing[];
  total: number;
  hasMore?: boolean;
  cursor?: string | null;
  errors?: Array<{
    message: string;
    page?: number;
    merchantSku?: string;
  }>;
};

export interface MarketplaceAdapter {
  testConnection(): Promise<MarketplaceConnectionResult>;
  fetchOrders(input: {
    since: Date;
    cursor?: string | null;
    limit?: number;
  }): Promise<MarketplaceFetchOrdersResult>;
  fetchListings?(input: {
    cursor?: string | null;
    limit?: number;
  }): Promise<MarketplaceFetchListingsResult>;
  mapStatus(externalStatus: string): OrderStatus;
  pushShipment?(input: ShipmentPushInput): Promise<void>;
}
