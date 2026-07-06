import type { Prisma, OrderSourceChannel, OrderStatus, PaymentStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  getSourceChannelLabel,
  isMarketplaceChannel,
  mapOrderStatusToLabel,
  getAllowedNextStatuses,
} from "@/lib/order-utils";
import { getSaleRemainingAmount } from "@/lib/sale-payment-utils";
import { updateOrderById } from "@/lib/order-service";
import { MobilePosError } from "./mobile-pos-errors";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const ORDER_STATUSES: OrderStatus[] = [
  "WAITING",
  "APPROVED",
  "SHIPPING",
  "DELIVERED",
  "RETURN_REQUESTED",
  "RETURNED",
  "CANCELLED",
];

const CHANNELS: OrderSourceChannel[] = [
  "MANUAL",
  "POS",
  "WEBSITE",
  "TRENDYOL",
  "HEPSIBURADA",
  "N11",
  "AMAZON",
  "CICEKSEPETI",
  "ETSY",
  "OTHER",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "PARTIAL", "FAILED"];

function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "PAID":
      return "Ödendi";
    case "PARTIAL":
      return "Kısmi Ödendi";
    case "UNPAID":
      return "Ödenmedi";
    case "FAILED":
      return "Başarısız";
    default:
      return status;
  }
}

function shipmentStatusFromOrderStatus(status: OrderStatus): "NONE" | "PENDING" | "SHIPPED" | "DELIVERED" {
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "SHIPPING") return "SHIPPED";
  return "PENDING";
}

function shipmentStatusLabel(status: "NONE" | "PENDING" | "SHIPPED" | "DELIVERED") {
  switch (status) {
    case "DELIVERED":
      return "Teslim Edildi";
    case "SHIPPED":
      return "Kargoda";
    case "PENDING":
      return "Kargo Bekliyor";
    default:
      return "—";
  }
}

export type MobileOrdersListFilters = {
  search?: string;
  channel?: string;
  status?: string;
  paymentStatus?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest";
};

function parseDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function listMobileOrders(companyId: string, filters: MobileOrdersListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const where: Prisma.SaleWhereInput = { companyId };

  if (filters.channel && (CHANNELS as string[]).includes(filters.channel)) {
    where.sourceChannel = filters.channel as OrderSourceChannel;
  }
  if (filters.status && (ORDER_STATUSES as string[]).includes(filters.status)) {
    where.orderStatus = filters.status as OrderStatus;
  }
  if (filters.paymentStatus && (PAYMENT_STATUSES as string[]).includes(filters.paymentStatus)) {
    where.paymentStatus = filters.paymentStatus as PaymentStatus;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  const dateFrom = parseDate(filters.dateFrom);
  const dateTo = parseDate(filters.dateTo);
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { saleNo: { contains: search, mode: "insensitive" } },
      { externalOrderId: { contains: search, mode: "insensitive" } },
      { trackingNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { phone: { contains: search, mode: "insensitive" } } },
      { items: { some: { name: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const orderBy: Prisma.SaleOrderByWithRelationInput = {
    createdAt: filters.sort === "oldest" ? "asc" : "desc",
  };

  const [total, rows, summaryRows] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { items: true } },
      },
    }),
    db.sale.findMany({
      where,
      select: { orderStatus: true, sourceChannel: true, total: true },
    }),
  ]);

  const summary = {
    totalOrders: summaryRows.length,
    newOrders: summaryRows.filter((r) => r.orderStatus === "WAITING").length,
    preparingOrders: summaryRows.filter((r) => r.orderStatus === "APPROVED").length,
    shippedOrders: summaryRows.filter((r) => r.orderStatus === "SHIPPING").length,
    cancelledOrders: summaryRows.filter((r) => r.orderStatus === "CANCELLED").length,
    marketplaceOrders: summaryRows.filter((r) => isMarketplaceChannel(r.sourceChannel)).length,
    totalAmountMinor: Math.round(
      summaryRows.reduce((sum, r) => sum + Number(r.total), 0) * 100
    ),
  };

  const items = rows.map((sale) => {
    const shipStatus = shipmentStatusFromOrderStatus(sale.orderStatus);
    const totalQuantity = 0; // resolved below via items count only (avoid N+1 sum query per row)
    return {
      id: sale.id,
      orderNumber: sale.saleNo,
      externalOrderNumber: sale.externalOrderId,
      channel: sale.sourceChannel,
      channelLabel: getSourceChannelLabel(sale.sourceChannel),
      status: sale.orderStatus,
      statusLabel: mapOrderStatusToLabel(sale.orderStatus),
      paymentStatus: sale.paymentStatus,
      paymentStatusLabel: paymentStatusLabel(sale.paymentStatus),
      shipmentStatus: shipStatus,
      shipmentStatusLabel: shipmentStatusLabel(shipStatus),
      customer: sale.customer
        ? { id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone }
        : null,
      itemCount: sale._count.items,
      totalQuantity,
      totalMinor: Math.round(Number(sale.total) * 100),
      currency: "TRY" as const,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      shipment:
        sale.shippingCarrier && sale.trackingNumber
          ? { carrier: sale.shippingCarrier, trackingNumber: sale.trackingNumber }
          : null,
      canUpdateStatus: getAllowedNextStatuses(sale.orderStatus).length > 0,
      canCancel: getAllowedNextStatuses(sale.orderStatus).includes("CANCELLED"),
      canCreateShipment:
        sale.orderStatus === "APPROVED" ||
        (sale.orderStatus === "SHIPPING" && (!sale.trackingNumber || !sale.shippingCarrier)),
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    summary,
  };
}

export async function getMobileOrderDetail(companyId: string, orderId: string) {
  const sale = await db.sale.findFirst({
    where: { id: orderId, companyId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
      invoice: { select: { id: true, invoiceNo: true } },
      items: {
        select: {
          id: true,
          productId: true,
          name: true,
          quantity: true,
          unitPrice: true,
          vatRate: true,
          total: true,
          product: { select: { sku: true, barcode: true, imageUrl: true } },
        },
      },
    },
  });

  if (!sale) {
    throw new MobilePosError("NOT_FOUND", "Sipariş bulunamadı.", 404);
  }

  const allowedNext = getAllowedNextStatuses(sale.orderStatus);
  const shipStatus = shipmentStatusFromOrderStatus(sale.orderStatus);

  const timeline: Array<{ label: string; at: string | null }> = [
    { label: "Sipariş oluşturuldu", at: sale.createdAt.toISOString() },
  ];
  if (sale.orderStatus !== "WAITING") {
    timeline.push({ label: "Onaylandı", at: sale.updatedAt.toISOString() });
  }
  if (sale.shippedAt) {
    timeline.push({ label: "Kargoya verildi", at: sale.shippedAt.toISOString() });
  }
  if (sale.deliveredAt) {
    timeline.push({ label: "Teslim edildi", at: sale.deliveredAt.toISOString() });
  }
  if (sale.orderStatus === "CANCELLED") {
    timeline.push({ label: "İptal edildi", at: sale.updatedAt.toISOString() });
  }

  const subtotal = Number(sale.subtotal);
  const discount = Number(sale.discount);
  const vatTotal = Number(sale.vatTotal);
  const total = Number(sale.total);
  const paidAmount = Number(sale.paidAmount);

  return {
    id: sale.id,
    orderNumber: sale.saleNo,
    externalOrderNumber: sale.externalOrderId,
    channel: sale.sourceChannel,
    channelLabel: getSourceChannelLabel(sale.sourceChannel),
    status: sale.orderStatus,
    statusLabel: mapOrderStatusToLabel(sale.orderStatus),
    paymentStatus: sale.paymentStatus,
    paymentStatusLabel: paymentStatusLabel(sale.paymentStatus),
    shipmentStatus: shipStatus,
    shipmentStatusLabel: shipmentStatusLabel(shipStatus),
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone,
          email: sale.customer.email,
        }
      : null,
    // Şema yalnız tek bir Customer.address alanı destekliyor — ayrı fatura/teslimat
    // adres kaydı yok, bu yüzden ikisi de aynı kaynaktan (varsa) türetiliyor.
    billingAddress: sale.customer?.address ?? null,
    shippingAddress: sale.customer?.address ?? null,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: null as string | null,
      name: item.name,
      sku: item.product?.sku ?? null,
      barcode: item.product?.barcode ?? null,
      imageUrl: item.product?.imageUrl ?? null,
      quantity: item.quantity,
      unitPriceMinor: Math.round(Number(item.unitPrice) * 100),
      discountMinor: 0,
      totalMinor: Math.round(Number(item.total) * 100),
    })),
    subtotalMinor: Math.round(subtotal * 100),
    discountMinor: Math.round(discount * 100),
    shippingMinor: 0,
    taxMinor: Math.round(vatTotal * 100),
    totalMinor: Math.round(total * 100),
    currency: "TRY" as const,
    note: sale.note?.trim() || null,
    customerNote: null as string | null,
    marketplaceNote: sale.orderNote?.trim() || null,
    remainingMinor: Math.round(getSaleRemainingAmount(total, paidAmount) * 100),
    paidAmountMinor: Math.round(paidAmount * 100),
    shipment:
      sale.shippingCarrier && sale.trackingNumber
        ? {
            carrier: sale.shippingCarrier,
            trackingNumber: sale.trackingNumber,
            shippedAt: sale.shippedAt?.toISOString() ?? null,
            deliveredAt: sale.deliveredAt?.toISOString() ?? null,
          }
        : null,
    invoice: sale.invoice ? { id: sale.invoice.id, invoiceNumber: sale.invoice.invoiceNo } : null,
    marketplace: isMarketplaceChannel(sale.sourceChannel)
      ? {
          channel: sale.sourceChannel,
          externalOrderNumber: sale.externalOrderId,
          // Şemada paket no / son senkron zamanı / kanal ham durum etiketi için
          // ayrı bir alan yok — mevcut mimaride yalnız externalOrderId tutuluyor.
          packageNumber: null as string | null,
          merchantSku: null as string | null,
          lastSyncedAt: null as string | null,
          rawStatusLabel: null as string | null,
        }
      : null,
    timeline,
    permissions: {
      canUpdateStatus: allowedNext.length > 0,
      canCancel: allowedNext.includes("CANCELLED"),
      canCreateShipment:
        sale.orderStatus === "APPROVED" ||
        (sale.orderStatus === "SHIPPING" && (!sale.trackingNumber || !sale.shippingCarrier)),
      allowedNextStatuses: allowedNext,
    },
  };
}

function toOrderDto(sale: NonNullable<Awaited<ReturnType<typeof db.sale.findFirst>>>) {
  const shipStatus = shipmentStatusFromOrderStatus(sale.orderStatus);
  return {
    id: sale.id,
    orderNumber: sale.saleNo,
    status: sale.orderStatus,
    statusLabel: mapOrderStatusToLabel(sale.orderStatus),
    shipmentStatus: shipStatus,
    shipmentStatusLabel: shipmentStatusLabel(shipStatus),
  };
}

export async function updateMobileOrderStatus(input: {
  companyId: string;
  userId: string;
  orderId: string;
  status: OrderStatus;
  note?: string;
}) {
  if (!(ORDER_STATUSES as string[]).includes(input.status)) {
    throw new MobilePosError("VALIDATION_ERROR", "Geçersiz sipariş durumu.", 400);
  }

  const result = await updateOrderById({
    saleId: input.orderId,
    companyId: input.companyId,
    userId: input.userId,
    data: {
      orderStatus: input.status,
      orderNote: input.note?.trim() || undefined,
    },
  });

  if (!result.ok) {
    throw new MobilePosError(
      result.status === 404 ? "NOT_FOUND" : "INVALID_TRANSITION",
      result.message,
      result.status
    );
  }

  return toOrderDto(result.data);
}

export async function cancelMobileOrder(input: {
  companyId: string;
  userId: string;
  orderId: string;
  reason: string;
  note?: string;
}) {
  const sale = await db.sale.findFirst({
    where: { id: input.orderId, companyId: input.companyId },
    select: { orderStatus: true },
  });
  if (!sale) {
    throw new MobilePosError("NOT_FOUND", "Sipariş bulunamadı.", 404);
  }
  if (sale.orderStatus === "CANCELLED") {
    // İkinci iptal isteği idempotent — aynı sonucu döner, hata fırlatmaz.
    const current = await db.sale.findFirst({ where: { id: input.orderId, companyId: input.companyId } });
    return toOrderDto(current!);
  }

  const combinedNote = [`İptal nedeni: ${input.reason}`, input.note?.trim()]
    .filter(Boolean)
    .join(" · ");

  const result = await updateOrderById({
    saleId: input.orderId,
    companyId: input.companyId,
    userId: input.userId,
    data: {
      orderStatus: "CANCELLED",
      orderNote: combinedNote,
    },
  });

  if (!result.ok) {
    throw new MobilePosError(
      result.status === 404 ? "NOT_FOUND" : "CANCEL_NOT_ALLOWED",
      result.message,
      result.status
    );
  }

  return toOrderDto(result.data);
}

export async function addMobileOrderShipment(input: {
  companyId: string;
  userId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  shippedAt?: string;
}) {
  const sale = await db.sale.findFirst({
    where: { id: input.orderId, companyId: input.companyId },
    select: { orderStatus: true, trackingNumber: true },
  });
  if (!sale) {
    throw new MobilePosError("NOT_FOUND", "Sipariş bulunamadı.", 404);
  }
  if (sale.orderStatus === "CANCELLED") {
    throw new MobilePosError(
      "ORDER_CANCELLED",
      "İptal edilmiş siparişe gönderi eklenemez.",
      400
    );
  }

  const trackingNumber = input.trackingNumber.trim();
  if (!trackingNumber) {
    throw new MobilePosError("VALIDATION_ERROR", "Takip numarası zorunludur.", 400);
  }

  if (sale.trackingNumber && sale.trackingNumber === trackingNumber) {
    throw new MobilePosError(
      "DUPLICATE_TRACKING",
      "Bu takip numarası zaten bu siparişe eklenmiş.",
      400
    );
  }

  const result = await updateOrderById({
    saleId: input.orderId,
    companyId: input.companyId,
    userId: input.userId,
    data: {
      orderStatus: "SHIPPING",
      shippingCarrier: input.carrier.trim(),
      trackingNumber,
      shippedAt: input.shippedAt ? new Date(input.shippedAt).toISOString() : undefined,
    },
  });

  if (!result.ok) {
    throw new MobilePosError(
      result.status === 404 ? "NOT_FOUND" : "SHIPMENT_INVALID",
      result.message,
      result.status
    );
  }

  return toOrderDto(result.data);
}
