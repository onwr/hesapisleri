import type { OrderStatus } from "@prisma/client";
import { mapTrendyolStatusToOrderStatus } from "@/lib/marketplace/marketplace-status-map";
import type {
  MarketplaceAdapter,
  MarketplaceConnectionResult,
  MarketplaceFetchListingsResult,
  MarketplaceFetchOrdersResult,
  NormalizedMarketplaceListing,
  NormalizedMarketplaceOrder,
} from "@/lib/marketplace/marketplace-types";

type TrendyolCredentials = {
  supplierId: string;
  apiKey: string;
  apiSecret: string;
};

type TrendyolPackageLine = {
  merchantSku?: string;
  barcode?: string;
  productName?: string;
  quantity?: number;
  price?: number;
  vatBaseAmount?: number;
  linePrice?: number;
  lineItemPrice?: number;
};

type TrendyolPackage = {
  orderNumber?: string;
  shipmentPackageId?: number | string;
  packageStatus?: string;
  status?: string;
  orderDate?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shipmentAddress?: {
    fullName?: string;
    phone?: string;
    fullAddress?: string;
  };
  cargoProviderName?: string;
  cargoTrackingNumber?: string;
  deliveredDate?: string;
  shippedDate?: string;
  lines?: TrendyolPackageLine[];
  lineItems?: TrendyolPackageLine[];
  totalPrice?: number;
  grossAmount?: number;
  totalDiscount?: number;
};

type TrendyolResponse = {
  content?: TrendyolPackage[];
  totalPages?: number;
  totalElements?: number;
  page?: number;
};

type TrendyolProductItem = {
  stockCode?: string;
  barcode?: string;
  title?: string;
  salePrice?: number;
  listPrice?: number;
  quantity?: number;
  productCode?: number | string;
  productMainId?: string;
  platformListingId?: string;
};

type TrendyolProductResponse = {
  content?: TrendyolProductItem[];
  totalPages?: number;
  totalElements?: number;
  page?: number;
};

const MAX_ORDER_LIMIT = 500;
const MAX_LISTING_LIMIT = 2000;
const MAX_PAGE_COUNT = 20;
const TRANSIENT_STATUSES = new Set([429, 502, 503]);

function toTimestampMs(date: Date) {
  return date.getTime();
}

function parseDate(value?: string | number | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function buildBasicAuth(credentials: TrendyolCredentials) {
  const raw = `${credentials.apiKey}:${credentials.apiSecret}`;
  return Buffer.from(raw).toString("base64");
}

function getTrendyolBaseUrl(supplierId: string) {
  const env = process.env.MARKETPLACE_ENV ?? "production";
  if (env === "stage") {
    return `https://stageapigw.trendyol.com/integration/order/sellers/${supplierId}`;
  }
  return `https://apigw.trendyol.com/integration/order/sellers/${supplierId}`;
}

function getTrendyolProductBaseUrl(supplierId: string) {
  const env = process.env.MARKETPLACE_ENV ?? "production";
  if (env === "stage") {
    return `https://stageapigw.trendyol.com/integration/product/sellers/${supplierId}`;
  }
  return `https://apigw.trendyol.com/integration/product/sellers/${supplierId}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeResponseErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "API bilgileri hatalı veya yetkisiz.";
  }
  if (status === 429) {
    return "Rate limit aşıldı, birkaç dakika sonra tekrar deneyin.";
  }
  if (status === 502 || status === 503) {
    return "Trendyol geçici olarak yanıt vermedi, tekrar deneyin.";
  }
  return `Trendyol API hatası: ${status}`;
}

function mapPackageToNormalizedOrder(pkg: TrendyolPackage): NormalizedMarketplaceOrder | null {
  const externalOrderId =
    pkg.orderNumber?.trim() || String(pkg.shipmentPackageId ?? "").trim();
  if (!externalOrderId) return null;

  const createdAt =
    parseDate(pkg.orderDate) ??
    parseDate(pkg.shippedDate) ??
    parseDate(pkg.deliveredDate) ??
    new Date();
  const rawStatus = pkg.packageStatus ?? pkg.status ?? "Created";
  const lines = pkg.lines ?? pkg.lineItems ?? [];

  const customerName = [
    pkg.customerFirstName ?? pkg.shipmentAddress?.fullName ?? "",
    pkg.customerLastName ?? "",
  ]
    .join(" ")
    .trim();

  const normalizedLines = lines.map((line) => {
    const quantity = toNumber(line.quantity, 1);
    const unitPrice = toNumber(
      line.price ?? line.lineItemPrice ?? line.linePrice,
      0
    );

    return {
      merchantSku: line.merchantSku ?? "",
      barcode: line.barcode ?? undefined,
      name: line.productName ?? "Trendyol Ürünü",
      quantity,
      unitPrice,
      vatRate: undefined,
      lineId: undefined,
    };
  });

  const subtotal = normalizedLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );
  const discount = toNumber(pkg.totalDiscount, 0);
  const total = toNumber(pkg.totalPrice ?? pkg.grossAmount, subtotal - discount);

  return {
    externalOrderId,
    externalPackageId: pkg.shipmentPackageId
      ? String(pkg.shipmentPackageId)
      : undefined,
    channel: "TRENDYOL",
    createdAt,
    customer: {
      name: customerName || "Trendyol Müşterisi",
      phone: pkg.customerPhone ?? pkg.shipmentAddress?.phone,
      email: pkg.customerEmail,
      address: pkg.shipmentAddress?.fullAddress,
    },
    items: normalizedLines,
    totals: {
      subtotal,
      discount,
      total,
    },
    externalStatus: rawStatus,
    orderStatus: mapTrendyolStatusToOrderStatus(rawStatus),
    shipping: {
      carrier: pkg.cargoProviderName,
      trackingNumber: pkg.cargoTrackingNumber,
      shippedAt: parseDate(pkg.shippedDate),
      deliveredAt: parseDate(pkg.deliveredDate),
    },
    rawPayload: pkg,
  };
}

export function mapTrendyolProductToListing(
  item: TrendyolProductItem
): NormalizedMarketplaceListing | null {
  const merchantSku = pickString(item.stockCode, item.productMainId);
  if (!merchantSku) return null;

  const priceValue =
    item.salePrice != null
      ? toNumber(item.salePrice, 0)
      : item.listPrice != null
        ? toNumber(item.listPrice, 0)
        : null;

  return {
    externalListingId: pickString(
      item.platformListingId,
      item.productCode,
      item.productMainId
    ) || undefined,
    merchantSku,
    barcode: item.barcode?.trim() || null,
    title: item.title?.trim() || null,
    price: priceValue,
    stockQuantity: item.quantity != null ? toNumber(item.quantity, 0) : null,
    raw: item,
  };
}

export class TrendyolAdapter implements MarketplaceAdapter {
  private readonly credentials: TrendyolCredentials;
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private readonly productBaseUrl: string;

  constructor(credentials: TrendyolCredentials) {
    this.credentials = credentials;
    this.authHeader = `Basic ${buildBasicAuth(credentials)}`;
    this.baseUrl = getTrendyolBaseUrl(credentials.supplierId);
    this.productBaseUrl = getTrendyolProductBaseUrl(credentials.supplierId);
  }

  mapStatus(externalStatus: string): OrderStatus {
    return mapTrendyolStatusToOrderStatus(externalStatus);
  }

  async testConnection(): Promise<MarketplaceConnectionResult> {
    try {
      const response = await this.fetchPage({
        page: 0,
        size: 1,
        startDate: Date.now() - 24 * 60 * 60 * 1000,
        endDate: Date.now(),
      });

      const orderCount = response.content?.length ?? 0;
      const total = response.totalElements ?? orderCount;

      return {
        ok: true,
        message:
          total > 0
            ? `Bağlantı başarılı. Trendyol API erişimi doğrulandı (${total} sipariş bulundu).`
            : "Bağlantı başarılı. Trendyol API erişimi doğrulandı. Son 24 saatte sipariş bulunamadı.",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Trendyol bağlantısı başarısız.";
      return { ok: false, message };
    }
  }

  async fetchOrders(input: {
    since: Date;
    cursor?: string | null;
    limit?: number;
  }): Promise<MarketplaceFetchOrdersResult> {
    const overlapSince = new Date(input.since.getTime() - 5 * 60 * 1000);
    const startDate = toTimestampMs(overlapSince);
    const endDate = toTimestampMs(new Date());
    const size = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const startPage = Number(input.cursor ?? "0") || 0;
    let page = startPage;
    let totalPages = 1;
    const orders: NormalizedMarketplaceOrder[] = [];
    const errors: NonNullable<MarketplaceFetchOrdersResult["errors"]> = [];

    while (
      page < totalPages &&
      page - startPage < MAX_PAGE_COUNT &&
      orders.length < MAX_ORDER_LIMIT
    ) {
      try {
        const response = await this.fetchPage({ page, size, startDate, endDate });
        totalPages = Math.max(response.totalPages ?? 1, 1);

        for (const pkg of response.content ?? []) {
          const normalized = mapPackageToNormalizedOrder(pkg);
          if (normalized) {
            orders.push(normalized);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Trendyol sipariş sayfası alınamadı.";
        errors.push({ message, page });
      } finally {
        page += 1;
      }
    }

    if (page - startPage >= MAX_PAGE_COUNT && page < totalPages) {
      errors.push({
        message: `Sayfa güvenlik limiti aşıldı. En fazla ${MAX_PAGE_COUNT} sayfa işlendi.`,
        page,
      });
    }
    if (orders.length >= MAX_ORDER_LIMIT && page < totalPages) {
      errors.push({
        message: `Sipariş güvenlik limiti aşıldı. En fazla ${MAX_ORDER_LIMIT} sipariş işlendi.`,
        page,
      });
    }

    return {
      orders,
      nextCursor: undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async fetchListings(input: {
    cursor?: string | null;
    limit?: number;
  }): Promise<MarketplaceFetchListingsResult> {
    const size = Math.min(Math.max(input.limit ?? 100, 1), 100);
    const startPage = Number(input.cursor ?? "0") || 0;
    let page = startPage;
    let totalPages = 1;
    let totalElements = 0;
    const listings: NormalizedMarketplaceListing[] = [];
    const errors: NonNullable<MarketplaceFetchListingsResult["errors"]> = [];

    while (
      page < totalPages &&
      page - startPage < MAX_PAGE_COUNT &&
      listings.length < MAX_LISTING_LIMIT
    ) {
      try {
        const response = await this.fetchProductPage({ page, size });
        totalPages = Math.max(response.totalPages ?? 1, 1);
        totalElements = response.totalElements ?? totalElements;

        for (const item of response.content ?? []) {
          const normalized = mapTrendyolProductToListing(item);
          if (normalized) {
            listings.push(normalized);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Trendyol ürün sayfası alınamadı.";
        errors.push({ message, page });
        break;
      } finally {
        page += 1;
      }
    }

    if (page - startPage >= MAX_PAGE_COUNT && page < totalPages) {
      errors.push({
        message: `Sayfa güvenlik limiti aşıldı. En fazla ${MAX_PAGE_COUNT} sayfa işlendi.`,
        page,
      });
    }
    if (listings.length >= MAX_LISTING_LIMIT && page < totalPages) {
      errors.push({
        message: `Listing güvenlik limiti aşıldı. En fazla ${MAX_LISTING_LIMIT} kayıt işlendi.`,
        page,
      });
    }

    const hasMore = page < totalPages;
    return {
      listings,
      total: totalElements || listings.length,
      hasMore,
      cursor: hasMore ? String(page) : null,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async fetchProductPage(input: { page: number; size: number }) {
    const params = new URLSearchParams({
      approved: "true",
      page: String(input.page),
      size: String(input.size),
    });
    const url = `${this.productBaseUrl}/products?${params.toString()}`;
    const retryDelays = [750, 1500];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          "User-Agent": `${this.credentials.supplierId} - SelfIntegration`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        return (await response.json()) as TrendyolProductResponse;
      }

      const message = normalizeResponseErrorMessage(response.status);
      if (response.status === 401 || response.status === 403) {
        throw new Error(message);
      }

      if (TRANSIENT_STATUSES.has(response.status) && attempt < retryDelays.length) {
        lastError = new Error(message);
        await sleep(retryDelays[attempt]);
        continue;
      }

      throw new Error(message);
    }

    throw lastError ?? new Error("Trendyol ürün sayfası alınamadı.");
  }

  private async fetchPage(input: {
    page: number;
    size: number;
    startDate: number;
    endDate: number;
  }) {
    const params = new URLSearchParams({
      page: String(input.page),
      size: String(input.size),
      startDate: String(input.startDate),
      endDate: String(input.endDate),
      orderByField: "PackageLastModifiedDate",
      orderByDirection: "DESC",
    });
    const url = `${this.baseUrl}/orders?${params.toString()}`;
    const retryDelays = [750, 1500];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          "User-Agent": `${this.credentials.supplierId} - SelfIntegration`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        return (await response.json()) as TrendyolResponse;
      }

      const message = normalizeResponseErrorMessage(response.status);
      if (response.status === 401 || response.status === 403) {
        throw new Error(message);
      }

      if (TRANSIENT_STATUSES.has(response.status) && attempt < retryDelays.length) {
        lastError = new Error(message);
        await sleep(retryDelays[attempt]);
        continue;
      }

      throw new Error(message);
    }

    throw lastError ?? new Error("Trendyol sipariş sayfası alınamadı.");
  }
}

export type { TrendyolCredentials };
