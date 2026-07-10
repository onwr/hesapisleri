import type {
  OrderSourceChannel,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import { generateSaleNo } from "@/lib/sale-number-utils";
import { getMarketplaceAdapter } from "@/lib/marketplace/marketplace-integration-service";
import type {
  MarketplaceChannel,
  NormalizedMarketplaceOrder,
} from "@/lib/marketplace/marketplace-types";
import { buildMarketplaceOrderNote } from "@/lib/marketplace/marketplace-order-note";

type SyncInput = {
  companyId: string;
  channel: MarketplaceChannel;
  type: "MANUAL" | "AUTO" | "TEST";
  triggeredByUserId?: string;
};

type SyncRunErrorItem = {
  message: string;
  page?: number;
  externalOrderId?: string;
  merchantSku?: string;
  rawStatus?: string;
};

type UnsafeTransactionClient = Prisma.TransactionClient & Record<string, any>;
const marketplaceDb = db as typeof db & Record<string, any>;

type ProcessOrderResult = {
  result: "created" | "updated" | "skipped";
  errors?: SyncRunErrorItem[];
};

function toSaleChannel(channel: MarketplaceChannel): OrderSourceChannel {
  return channel;
}

function resolveSince(lastSyncAt?: Date | null) {
  if (!lastSyncAt) {
    // Trendyol tarih aralığı sorgularında en fazla ~14 gün desteklenir.
    return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  }
  return new Date(lastSyncAt.getTime() - 5 * 60 * 1000);
}

function buildMarketplaceCustomerName(channel: MarketplaceChannel) {
  return channel === "TRENDYOL"
    ? "Trendyol Müşterileri"
    : "Hepsiburada Müşterileri";
}

async function getOrCreateMarketplaceCustomer(
  tx: UnsafeTransactionClient,
  companyId: string,
  channel: MarketplaceChannel
) {
  const name = buildMarketplaceCustomerName(channel);
  const existing = await tx.customer.findFirst({
    where: { companyId, name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.customer.create({
    data: {
      companyId,
      name,
      group: "Pazaryeri",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return created.id;
}

async function resolveProductId(input: {
  tx: UnsafeTransactionClient;
  companyId: string;
  channel: MarketplaceChannel;
  merchantSku: string;
  barcode?: string;
}) {
  const sku = input.merchantSku.trim();
  if (sku) {
    const mapped = await input.tx.productChannelMapping.findFirst({
      where: {
        companyId: input.companyId,
        channel: input.channel,
        merchantSku: sku,
      },
      select: { productId: true },
    });
    if (mapped) return mapped.productId;

    const productBySku = await input.tx.product.findFirst({
      where: { companyId: input.companyId, sku },
      select: { id: true },
    });
    if (productBySku) return productBySku.id;
  }

  if (input.barcode?.trim()) {
    const productByBarcode = await input.tx.product.findFirst({
      where: { companyId: input.companyId, barcode: input.barcode.trim() },
      select: { id: true },
    });
    if (productByBarcode) return productByBarcode.id;
  }

  return null;
}

async function processMarketplaceOrder(input: {
  tx: UnsafeTransactionClient;
  companyId: string;
  channel: MarketplaceChannel;
  defaultWarehouseId?: string | null;
  customerId: string;
  order: NormalizedMarketplaceOrder;
}) {
  const { tx, order } = input;
  if (!order.externalOrderId) {
    return {
      result: "skipped",
      errors: [{ message: "externalOrderId boş olduğu için sipariş atlandı." }],
    } as ProcessOrderResult;
  }

  const resolvedItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
    productId: string | null;
    merchantSku: string;
  }> = [];
  const unmatchedSkus: string[] = [];

  for (const item of order.items) {
    const productId = await resolveProductId({
      tx,
      companyId: input.companyId,
      channel: input.channel,
      merchantSku: item.merchantSku,
      barcode: item.barcode,
    });
    if (!productId && item.merchantSku) {
      unmatchedSkus.push(item.merchantSku);
    }
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Number(item.unitPrice || 0);
    const vatRate = Number(item.vatRate ?? 20);
    resolvedItems.push({
      name: item.name || item.merchantSku || "Pazaryeri Ürünü",
      quantity,
      unitPrice,
      vatRate,
      total: quantity * unitPrice,
      productId,
      merchantSku: item.merchantSku,
    });
  }

  const hasUnmatched = unmatchedSkus.length > 0;
  const resolvedOrderStatus: OrderStatus = hasUnmatched
    ? "WAITING"
    : order.orderStatus;

  const unmatchedMessage = hasUnmatched
    ? `Eşleşmeyen SKU: ${unmatchedSkus.join(", ")}. Ürün eşlemesi yapıldıktan sonra onaylayın.`
    : null;

  const initialOrderNote = buildMarketplaceOrderNote({
    existingNote: undefined,
    buyerName: order.customer.name,
    buyerPhone: order.customer.phone,
    channel: input.channel,
    externalStatus: order.externalStatus,
    externalPackageId: order.externalPackageId,
    unmatchedSkus: hasUnmatched ? unmatchedSkus : undefined,
  });

  const existing = await tx.sale.findFirst({
    where: {
      companyId: input.companyId,
      sourceChannel: toSaleChannel(input.channel),
      externalOrderId: order.externalOrderId,
    },
    select: { id: true, orderNote: true },
  });

  if (existing) {
    const current = await tx.sale.findUnique({
      where: { id: existing.id },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            name: true,
            productId: true,
          },
        },
      },
    });
    if (!current) {
      return {
        result: "skipped",
        errors: [
          {
            externalOrderId: order.externalOrderId,
            message: "Sipariş bulunamadı, güncelleme atlandı.",
          },
        ],
      };
    }

    const itemDiffSummary =
      current.items.length !== resolvedItems.length ||
      current.items.some((item, index) => {
        const next = resolvedItems[index];
        if (!next) return true;
        return (
          Number(item.quantity) !== Number(next.quantity) ||
          Number(item.unitPrice) !== Number(next.unitPrice) ||
          Number(item.total) !== Number(next.total) ||
          item.name !== next.name ||
          (item.productId ?? null) !== (next.productId ?? null)
        );
      });
    const totalsChanged = Number(current.total) !== Number(order.totals.total || 0);
    const shouldKeepItems =
      current.orderStatus === "APPROVED" || current.orderStatus === "DELIVERED";

    let changeMessage: string | null = null;
    if (itemDiffSummary || totalsChanged) {
      changeMessage = shouldKeepItems
        ? `Pazaryeri senkronunda içerik/tutar farkı tespit edildi ancak sipariş ${current.orderStatus} olduğu için kalemler korunarak yalnızca durum ve kargo alanları güncellendi.`
        : "Pazaryeri senkronunda içerik/tutar farkı tespit edildi ve sipariş WAITING olduğu için kalemler/tutarlar güncellendi.";
    }

    const mergedOrderNote = buildMarketplaceOrderNote({
      existingNote: current.orderNote,
      buyerName: order.customer.name,
      buyerPhone: order.customer.phone,
      channel: input.channel,
      externalStatus: order.externalStatus,
      externalPackageId: order.externalPackageId,
      unmatchedSkus: hasUnmatched ? unmatchedSkus : undefined,
    });

    await tx.sale.update({
      where: { id: existing.id },
      data: {
        orderStatus: resolvedOrderStatus,
        shippingCarrier: order.shipping?.carrier ?? null,
        trackingNumber: order.shipping?.trackingNumber ?? null,
        shippedAt: order.shipping?.shippedAt ?? null,
        deliveredAt: order.shipping?.deliveredAt ?? null,
        orderNote: mergedOrderNote,
        ...(shouldKeepItems
          ? {}
          : {
              subtotal:
                order.totals.subtotal ||
                resolvedItems.reduce((sum, item) => sum + item.total, 0),
              discount: order.totals.discount || 0,
              total:
                order.totals.total ||
                Math.max(
                  0,
                  (order.totals.subtotal ||
                    resolvedItems.reduce((sum, item) => sum + item.total, 0)) -
                    (order.totals.discount || 0)
                ),
              items: {
                deleteMany: {},
                create: resolvedItems.map((item) => ({
                  productId: item.productId,
                  warehouseId: input.defaultWarehouseId ?? null,
                  name: item.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  vatRate: item.vatRate,
                  total: item.total,
                })),
              },
            }),
      },
    });
    if (changeMessage) {
      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          action: "UPDATE",
          module: "orders",
          message: `${order.externalOrderId} - ${changeMessage}`,
        },
      });
    }
    return {
      result: "updated" as const,
      errors: hasUnmatched
        ? [
            {
              message: unmatchedMessage ?? "Eşleşmeyen SKU bulundu.",
              externalOrderId: order.externalOrderId,
              merchantSku: unmatchedSkus.join(", "),
              rawStatus: order.externalStatus,
            },
          ]
        : undefined,
    };
  }

  const subtotal =
    order.totals.subtotal ||
    resolvedItems.reduce((sum, item) => sum + item.total, 0);
  const discount = order.totals.discount || 0;
  const total = order.totals.total || Math.max(0, subtotal - discount);
  const vatTotal = 0;

  await tx.sale.create({
    data: {
      companyId: input.companyId,
      customerId: input.customerId,
      saleNo: generateSaleNo(),
      subtotal,
      vatTotal,
      discount,
      total,
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      sourceChannel: toSaleChannel(input.channel),
      externalOrderId: order.externalOrderId,
      orderStatus: resolvedOrderStatus,
      shippingCarrier: order.shipping?.carrier ?? null,
      trackingNumber: order.shipping?.trackingNumber ?? null,
      shippedAt: order.shipping?.shippedAt ?? null,
      deliveredAt: order.shipping?.deliveredAt ?? null,
      orderNote: initialOrderNote,
      warehouseId: input.defaultWarehouseId ?? null,
      createdAt: order.createdAt,
      items: {
        create: resolvedItems.map((item) => ({
          productId: item.productId,
          warehouseId: input.defaultWarehouseId ?? null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          total: item.total,
        })),
      },
    },
  });

  return {
    result: "created" as const,
    errors: hasUnmatched
      ? [
          {
            message: unmatchedMessage ?? "Eşleşmeyen SKU bulundu.",
            externalOrderId: order.externalOrderId,
            merchantSku: unmatchedSkus.join(", "),
            rawStatus: order.externalStatus,
          },
        ]
      : undefined,
  };
}

export async function syncMarketplaceIntegration(input: SyncInput) {
  const integration = await marketplaceDb.marketplaceIntegration.findUnique({
    where: {
      companyId_channel: { companyId: input.companyId, channel: input.channel },
    },
  });

  if (!integration || !integration.credentialsEncrypted) {
    throw new Error("Entegrasyon bilgileri eksik.");
  }

  const run = await marketplaceDb.marketplaceSyncRun.create({
    data: {
      companyId: input.companyId,
      integrationId: integration.id,
      channel: integration.channel,
      type: input.type,
      status: "RUNNING",
    },
  });

  try {
    const adapter = await getMarketplaceAdapter({
      channel: integration.channel,
      credentialsEncrypted: integration.credentialsEncrypted,
    });
    const since = resolveSince(integration.lastSyncAt);
    const fetched = await adapter.fetchOrders({
      since,
      cursor: integration.lastSyncCursor,
      limit: 100,
    });

    const counts = {
      fetchedCount: fetched.orders.length,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [] as SyncRunErrorItem[],
    };
    if (fetched.errors?.length) {
      counts.errors.push(...fetched.errors);
    }

    await db.$transaction(async (tx) => {
      const txClient = tx as UnsafeTransactionClient;
      const customerId = await getOrCreateMarketplaceCustomer(
        txClient,
        input.companyId,
        input.channel
      );

      for (const order of fetched.orders) {
        const result = await processMarketplaceOrder({
          tx: txClient,
          companyId: input.companyId,
          channel: input.channel,
          defaultWarehouseId: integration.defaultWarehouseId,
          customerId,
          order,
        });

        if (result.result === "created") counts.createdCount += 1;
        if (result.result === "updated") counts.updatedCount += 1;
        if (result.result === "skipped") counts.skippedCount += 1;
        if (result.errors?.length) counts.errors.push(...result.errors);
      }

      await txClient.marketplaceSyncRun.update({
        where: { id: run.id },
        data: {
          status:
            counts.errors.length === 0
              ? "SUCCESS"
              : counts.createdCount + counts.updatedCount > 0
                ? "PARTIAL_SUCCESS"
                : "FAILED",
          fetchedCount: counts.fetchedCount,
          createdCount: counts.createdCount,
          updatedCount: counts.updatedCount,
          skippedCount: counts.skippedCount,
          errors: counts.errors,
          finishedAt: new Date(),
        },
      });

      await txClient.marketplaceIntegration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncCursor: fetched.nextCursor ?? null,
          lastSyncStatus:
            counts.errors.length === 0
              ? "SUCCESS"
              : counts.createdCount + counts.updatedCount > 0
                ? "PARTIAL_SUCCESS"
                : "FAILED",
          lastError: counts.errors[0]?.message ?? null,
          status:
            counts.errors.length > 0 &&
            counts.createdCount === 0 &&
            counts.updatedCount === 0
              ? "ERROR"
              : "CONNECTED",
        },
      });

      await txClient.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.triggeredByUserId ?? null,
          action: "SYNC",
          module: "orders",
          message: `${input.channel} sipariş senkronizasyonu tamamlandı. Yeni: ${counts.createdCount}, güncel: ${counts.updatedCount}, atlanan: ${counts.skippedCount}, hata: ${counts.errors.length}.`,
        },
      });
    });

    return await marketplaceDb.marketplaceSyncRun.findUniqueOrThrow({
      where: { id: run.id },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Senkronizasyon başarısız.";
    await db.$transaction([
      marketplaceDb.marketplaceSyncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errors: [{ message }],
          finishedAt: new Date(),
        },
      }),
      marketplaceDb.marketplaceIntegration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          lastSyncStatus: "FAILED",
          lastError: message,
        },
      }),
    ]);
    throw error;
  }
}
