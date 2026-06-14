import type { OrderStatus } from "@prisma/client";
import { mapHepsiburadaStatusToOrderStatus } from "@/lib/marketplace/marketplace-status-map";
import type {
  MarketplaceAdapter,
  MarketplaceConnectionResult,
  MarketplaceFetchOrdersResult,
  NormalizedMarketplaceOrder,
  ShipmentPushInput,
} from "@/lib/marketplace/marketplace-types";

export type HepsiburadaCredentials = {
  merchantId: string;
  username?: string;
  password: string;
};

type HepsiburadaEndpointType = "packages" | "orders";

const MAX_ORDER_LIMIT = 500;
const MAX_PAGE_COUNT = 20;
const TRANSIENT_STATUSES = new Set([429, 502, 503]);
const RAW_PAYLOAD_MAX_LENGTH = 8000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function parseDate(value?: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatHepsiburadaDate(date: Date) {
  const formatted = date.toLocaleString("sv-SE", { timeZone: "Europe/Istanbul" });
  const [datePart, timePart] = formatted.split(" ");
  const [hh, mm] = (timePart ?? "00:00:00").split(":");
  return `${datePart} ${hh}:${mm}`;
}

function getHepsiburadaBaseUrl() {
  const env = process.env.MARKETPLACE_ENV ?? "production";
  if (env === "production") {
    return "https://oms-external.hepsiburada.com";
  }
  return "https://oms-external-sit.hepsiburada.com";
}

function normalizeResponseErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "API bilgileri hatalı veya yetkisiz.";
  }
  if (status === 429) {
    return "Rate limit aşıldı, birkaç dakika sonra tekrar deneyin.";
  }
  if (status >= 500) {
    return "Hepsiburada geçici olarak yanıt vermedi, tekrar deneyin.";
  }
  return `Hepsiburada API hatası: ${status}`;
}

function buildBasicAuth(credentials: HepsiburadaCredentials) {
  const user = credentials.username?.trim() || credentials.merchantId.trim();
  const raw = `${user}:${credentials.password}`;
  return Buffer.from(raw).toString("base64");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractHepsiburadaItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];

  for (const key of [
    "items",
    "packages",
    "orders",
    "data",
    "content",
    "result",
    "packageList",
    "orderList",
  ]) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  return [];
}

function extractItemsArray(raw: Record<string, unknown>) {
  for (const key of ["items", "lineItems", "orderItems", "packageItems", "products"]) {
    if (Array.isArray(raw[key])) {
      return raw[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function truncateRawPayload(raw: unknown) {
  const serialized = JSON.stringify(raw ?? {});
  if (serialized.length <= RAW_PAYLOAD_MAX_LENGTH) return raw;
  return {
    truncated: true,
    preview: serialized.slice(0, RAW_PAYLOAD_MAX_LENGTH),
  };
}

export function normalizeHepsiburadaOrder(
  rawInput: unknown
): NormalizedMarketplaceOrder | null {
  const raw = asRecord(rawInput);
  if (!raw) return null;

  const externalOrderId = pickString(
    raw.orderNumber,
    raw.orderNo,
    raw.orderId,
    raw.id,
    raw.packageNumber,
    raw.packageNo
  );
  if (!externalOrderId) return null;

  const itemsRaw = extractItemsArray(raw);
  if (itemsRaw.length === 0) return null;

  const customerRecord = asRecord(raw.customer);
  const invoiceRecord = asRecord(raw.invoice);
  const shippingAddress =
    asRecord(raw.shippingAddress) ?? asRecord(raw.deliveryAddress);

  const customerName =
    pickString(
      raw.customerName,
      raw.recipientName,
      customerRecord?.name,
      invoiceRecord?.name,
      shippingAddress?.name,
      shippingAddress?.fullName
    ) || "Hepsiburada Müşterisi";

  const normalizedLines = itemsRaw.map((item) => {
    const quantity = Math.max(
      1,
      toNumber(item.quantity ?? item.qty ?? item.count, 1)
    );
    const unitPrice = toNumber(
      item.unitPrice ?? item.price ?? item.salePrice ?? item.amount,
      0
    );
    const vatRate = toNumber(item.vatRate ?? item.taxRate, 20);

    return {
      merchantSku: pickString(
        item.merchantSku,
        item.merchantSKU,
        item.sku,
        item.productSku,
        item.hbSku,
        item.stockCode
      ),
      barcode: pickString(item.barcode) || undefined,
      name:
        pickString(item.name, item.productName, item.title) || "Hepsiburada Ürünü",
      quantity,
      unitPrice,
      vatRate,
      lineId: pickString(item.lineId, item.id) || undefined,
    };
  });

  const subtotal = normalizedLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );
  const discount = toNumber(raw.totalDiscount ?? raw.discount, 0);
  const total = toNumber(
    raw.totalPrice ?? raw.totalAmount ?? raw.amount,
    Math.max(0, subtotal - discount)
  );

  const rawStatus = pickString(
    raw.status,
    raw.packageStatus,
    raw.orderStatus,
    raw.state,
    "Open"
  );

  const createdAt =
    parseDate(raw.orderDate) ??
    parseDate(raw.createdDate) ??
    parseDate(raw.orderCreatedDate) ??
    new Date();

  return {
    externalOrderId,
    externalPackageId:
      pickString(raw.packageNumber, raw.packageNo, raw.packageId, raw.id) ||
      undefined,
    channel: "HEPSIBURADA",
    createdAt,
    customer: {
      name: customerName,
      phone:
        pickString(
          raw.phoneNumber,
          raw.customerPhone,
          shippingAddress?.phone
        ) || undefined,
      email: pickString(raw.customerEmail, customerRecord?.email) || undefined,
      address:
        pickString(
          shippingAddress?.address,
          shippingAddress?.fullAddress,
          raw.deliveryAddress,
          raw.address
        ) || undefined,
    },
    items: normalizedLines,
    totals: {
      subtotal,
      discount,
      total,
    },
    externalStatus: rawStatus,
    orderStatus: mapHepsiburadaStatusToOrderStatus(rawStatus),
    shipping: {
      carrier:
        pickString(
          raw.cargoCompany,
          raw.cargoCompanyName,
          raw.carrier
        ) || undefined,
      trackingNumber:
        pickString(
          raw.trackingNumber,
          raw.cargoTrackingNumber,
          raw.barcode
        ) || undefined,
      shippedAt: parseDate(raw.shippedDate ?? raw.shippingDate),
      deliveredAt: parseDate(raw.deliveredDate),
    },
    rawPayload: truncateRawPayload(raw),
  };
}

export class HepsiburadaAdapter implements MarketplaceAdapter {
  private readonly credentials: HepsiburadaCredentials;
  private readonly authHeader: string;
  private readonly baseUrl: string;
  private activeEndpoint: HepsiburadaEndpointType | null = null;

  constructor(credentials: HepsiburadaCredentials) {
    this.credentials = credentials;
    this.authHeader = `Basic ${buildBasicAuth(credentials)}`;
    this.baseUrl = getHepsiburadaBaseUrl();
  }

  mapStatus(externalStatus: string): OrderStatus {
    return mapHepsiburadaStatusToOrderStatus(externalStatus);
  }

  async testConnection(): Promise<MarketplaceConnectionResult> {
    try {
      const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await this.fetchOrders({ since, limit: 5 });
      return {
        ok: true,
        message: "Bağlantı başarılı. Hepsiburada API erişimi doğrulandı.",
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Hepsiburada bağlantısı başarısız.";
      return { ok: false, message };
    }
  }

  async fetchOrders(input: {
    since: Date;
    cursor?: string | null;
    limit?: number;
  }): Promise<MarketplaceFetchOrdersResult> {
    const overlapSince = input.since
      ? new Date(input.since.getTime() - 5 * 60 * 1000)
      : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const beginDate = formatHepsiburadaDate(overlapSince);
    const endDate = formatHepsiburadaDate(new Date());
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    let offset = Number(input.cursor ?? "0") || 0;

    const orders: NormalizedMarketplaceOrder[] = [];
    const errors: NonNullable<MarketplaceFetchOrdersResult["errors"]> = [];
    let pageCount = 0;

    while (pageCount < MAX_PAGE_COUNT && orders.length < MAX_ORDER_LIMIT) {
      try {
        const pageResult = await this.fetchHepsiburadaPage({
          offset,
          limit,
          beginDate,
          endDate,
        });

        for (const item of pageResult.items) {
          const normalized = normalizeHepsiburadaOrder(item);
          if (normalized) {
            orders.push(normalized);
          }
        }

        if (!pageResult.hasMore || pageResult.items.length === 0) {
          break;
        }

        offset += limit;
        pageCount += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Hepsiburada sipariş sayfası alınamadı.";
        errors.push({ message, page: offset });
        break;
      }
    }

    if (pageCount >= MAX_PAGE_COUNT) {
      errors.push({
        message: `Sayfa güvenlik limiti aşıldı. En fazla ${MAX_PAGE_COUNT} sayfa işlendi.`,
        page: offset,
      });
    }
    if (orders.length >= MAX_ORDER_LIMIT) {
      errors.push({
        message: `Sipariş güvenlik limiti aşıldı. En fazla ${MAX_ORDER_LIMIT} sipariş işlendi.`,
        page: offset,
      });
    }

    const hasMore = pageCount < MAX_PAGE_COUNT && orders.length < MAX_ORDER_LIMIT;
    return {
      orders,
      nextCursor: hasMore ? String(offset) : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async fetchHepsiburadaPage(input: {
    offset: number;
    limit: number;
    beginDate: string;
    endDate: string;
    endpointType?: HepsiburadaEndpointType;
  }) {
    const endpointType =
      input.endpointType ?? this.activeEndpoint ?? "packages";
    const primary = await this.fetchPageWithRetry(endpointType, input);

    if (primary.ok) {
      this.activeEndpoint = endpointType;
      return primary;
    }

    if (primary.status === 404 && endpointType === "packages") {
      const fallback = await this.fetchPageWithRetry("orders", input);
      if (fallback.ok) {
        this.activeEndpoint = "orders";
        return fallback;
      }
      throw new Error(fallback.message);
    }

    throw new Error(primary.message);
  }

  private async fetchPageWithRetry(
    endpointType: HepsiburadaEndpointType,
    input: {
      offset: number;
      limit: number;
      beginDate: string;
      endDate: string;
    }
  ) {
    const retryDelays = [750, 1500];
    let lastMessage = "Hepsiburada sipariş sayfası alınamadı.";

    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      const response = await fetch(this.buildEndpointUrl(endpointType, input), {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": `Hesapisleri-Hepsiburada-Integration/${this.credentials.merchantId}`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        const payload = await response.json();
        const items = extractHepsiburadaItems(payload);
        return {
          ok: true as const,
          status: response.status,
          items,
          hasMore: items.length >= input.limit,
          message: "",
        };
      }

      lastMessage = normalizeResponseErrorMessage(response.status);
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false as const,
          status: response.status,
          items: [],
          hasMore: false,
          message: lastMessage,
        };
      }

      if (TRANSIENT_STATUSES.has(response.status) && attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }

      return {
        ok: false as const,
        status: response.status,
        items: [],
        hasMore: false,
        message: lastMessage,
      };
    }

    return {
      ok: false as const,
      status: 503,
      items: [],
      hasMore: false,
      message: lastMessage,
    };
  }

  private buildEndpointUrl(
    endpointType: HepsiburadaEndpointType,
    input: {
      offset: number;
      limit: number;
      beginDate: string;
      endDate: string;
    }
  ) {
    const merchantId = encodeURIComponent(this.credentials.merchantId.trim());
    const params = new URLSearchParams({
      offset: String(input.offset),
      limit: String(input.limit),
      begindate: input.beginDate,
      enddate: input.endDate,
    });
    const path =
      endpointType === "packages"
        ? `/packages/merchantid/${merchantId}`
        : `/orders/merchantid/${merchantId}`;
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  async pushShipment(_input: ShipmentPushInput): Promise<void> {
    throw new Error("Hepsiburada kargo bildirimi bu sürümde desteklenmiyor.");
  }
}
