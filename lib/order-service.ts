import type { OrderSourceChannel, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  canTransitionOrderStatus,
  mapOrderStatusToLabel,
  validateShippingFields,
} from "@/lib/order-utils";

export const updateOrderSchema = z.object({
  orderStatus: z
    .enum([
      "WAITING",
      "APPROVED",
      "SHIPPING",
      "DELIVERED",
      "RETURN_REQUESTED",
      "RETURNED",
      "CANCELLED",
    ])
    .optional(),
  sourceChannel: z
    .enum([
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
    ])
    .optional(),
  externalOrderId: z.string().trim().max(120).optional().nullable(),
  shippingCarrier: z.string().trim().max(120).optional().nullable(),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  shippedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  orderNote: z.string().trim().max(2000).optional().nullable(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

type UpdateOrderParams = {
  saleId: string;
  companyId: string;
  userId: string;
  data: UpdateOrderInput;
};

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildOrderActivityMessage(
  saleNo: string,
  previousStatus: OrderStatus,
  nextStatus?: OrderStatus,
  extra?: string
) {
  if (nextStatus && nextStatus !== previousStatus) {
    return `${saleNo} sipariş durumu ${mapOrderStatusToLabel(previousStatus)} → ${mapOrderStatusToLabel(nextStatus)} olarak güncellendi.${extra ? ` ${extra}` : ""}`;
  }

  return `${saleNo} sipariş bilgileri güncellendi.${extra ? ` ${extra}` : ""}`;
}

export async function updateOrderById(params: UpdateOrderParams) {
  const sale = await db.sale.findFirst({
    where: {
      id: params.saleId,
      companyId: params.companyId,
    },
    select: {
      id: true,
      saleNo: true,
      orderStatus: true,
      shippingCarrier: true,
      trackingNumber: true,
      shippedAt: true,
      deliveredAt: true,
    },
  });

  if (!sale) {
    return {
      ok: false as const,
      status: 404,
      message: "Sipariş bulunamadı.",
    };
  }

  const { data } = params;
  const nextStatus = data.orderStatus ?? sale.orderStatus;

  if (
    data.orderStatus &&
    data.orderStatus !== sale.orderStatus &&
    !canTransitionOrderStatus(sale.orderStatus, data.orderStatus)
  ) {
    return {
      ok: false as const,
      status: 400,
      message: `${mapOrderStatusToLabel(sale.orderStatus)} durumundan ${mapOrderStatusToLabel(data.orderStatus)} durumuna geçilemez.`,
    };
  }

  const shippingCarrier =
    data.shippingCarrier !== undefined
      ? data.shippingCarrier
      : sale.shippingCarrier;
  const trackingNumber =
    data.trackingNumber !== undefined
      ? data.trackingNumber
      : sale.trackingNumber;

  if (nextStatus === "SHIPPING") {
    const shippingValidation = validateShippingFields({
      shippingCarrier,
      trackingNumber,
    });

    if (!shippingValidation.ok) {
      return {
        ok: false as const,
        status: 400,
        message: shippingValidation.message,
      };
    }
  }

  const now = new Date();
  const updateData: {
    orderStatus?: OrderStatus;
    sourceChannel?: OrderSourceChannel;
    externalOrderId?: string | null;
    shippingCarrier?: string | null;
    trackingNumber?: string | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    orderNote?: string | null;
  } = {};

  if (data.orderStatus) updateData.orderStatus = data.orderStatus;
  if (data.sourceChannel) updateData.sourceChannel = data.sourceChannel;
  if (data.externalOrderId !== undefined) {
    updateData.externalOrderId = data.externalOrderId;
  }
  if (data.shippingCarrier !== undefined) {
    updateData.shippingCarrier = data.shippingCarrier;
  }
  if (data.trackingNumber !== undefined) {
    updateData.trackingNumber = data.trackingNumber;
  }
  if (data.orderNote !== undefined) updateData.orderNote = data.orderNote;

  if (nextStatus === "SHIPPING") {
    const shippingValidation = validateShippingFields({
      shippingCarrier: data.shippingCarrier ?? sale.shippingCarrier,
      trackingNumber: data.trackingNumber ?? sale.trackingNumber,
    });

    if (shippingValidation.ok) {
      updateData.shippingCarrier = shippingValidation.shippingCarrier;
      updateData.trackingNumber = shippingValidation.trackingNumber;
      updateData.shippedAt =
        parseOptionalDate(data.shippedAt) ?? sale.shippedAt ?? now;
    }
  } else if (data.shippedAt !== undefined) {
    updateData.shippedAt = parseOptionalDate(data.shippedAt);
  }

  if (nextStatus === "DELIVERED") {
    updateData.deliveredAt =
      parseOptionalDate(data.deliveredAt) ?? sale.deliveredAt ?? now;
  } else if (data.deliveredAt !== undefined) {
    updateData.deliveredAt = parseOptionalDate(data.deliveredAt);
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.sale.update({
      where: { id: sale.id },
      data: updateData,
      include: {
        customer: true,
        items: true,
        warehouse: true,
        invoice: true,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: "UPDATE",
        module: "orders",
        message: buildOrderActivityMessage(
          sale.saleNo,
          sale.orderStatus,
          data.orderStatus,
          data.orderNote ? `Not: ${data.orderNote}` : undefined
        ),
      },
    });

    return result;
  });

  return {
    ok: true as const,
    data: updated,
  };
}

export async function bulkUpdateOrderStatus(input: {
  companyId: string;
  userId: string;
  ids: string[];
  orderStatus: OrderStatus;
}) {
  const sales = await db.sale.findMany({
    where: {
      companyId: input.companyId,
      id: { in: input.ids },
    },
    select: {
      id: true,
      saleNo: true,
      orderStatus: true,
      shippingCarrier: true,
      trackingNumber: true,
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  await db.$transaction(async (tx) => {
    for (const sale of sales) {
      if (!canTransitionOrderStatus(sale.orderStatus, input.orderStatus)) {
        skippedCount += 1;
        errors.push(
          `${sale.saleNo}: ${mapOrderStatusToLabel(sale.orderStatus)} → ${mapOrderStatusToLabel(input.orderStatus)} geçişi geçersiz.`
        );
        continue;
      }

      if (input.orderStatus === "SHIPPING") {
        const shippingValidation = validateShippingFields({
          shippingCarrier: sale.shippingCarrier,
          trackingNumber: sale.trackingNumber,
        });

        if (!shippingValidation.ok) {
          skippedCount += 1;
          errors.push(`${sale.saleNo}: ${shippingValidation.message}`);
          continue;
        }
      }

      const now = new Date();
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          orderStatus: input.orderStatus,
          ...(input.orderStatus === "SHIPPING"
            ? { shippedAt: now }
            : {}),
          ...(input.orderStatus === "DELIVERED"
            ? { deliveredAt: now }
            : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "UPDATE",
          module: "orders",
          message: buildOrderActivityMessage(
            sale.saleNo,
            sale.orderStatus,
            input.orderStatus
          ),
        },
      });

      updatedCount += 1;
    }
  });

  return {
    updatedCount,
    skippedCount,
    errors,
  };
}

export async function bulkUpdateOrderShipping(input: {
  companyId: string;
  userId: string;
  ids: string[];
  shippingCarrier: string;
  trackingNumber: string;
  shippedAt?: string | null;
}) {
  const shippingValidation = validateShippingFields({
    shippingCarrier: input.shippingCarrier,
    trackingNumber: input.trackingNumber,
  });

  if (!shippingValidation.ok) {
    return {
      ok: false as const,
      status: 400,
      message: shippingValidation.message,
    };
  }

  const sales = await db.sale.findMany({
    where: {
      companyId: input.companyId,
      id: { in: input.ids },
    },
    select: {
      id: true,
      saleNo: true,
      orderStatus: true,
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const shippedAt = input.shippedAt
    ? new Date(input.shippedAt)
    : new Date();

  await db.$transaction(async (tx) => {
    for (const sale of sales) {
      if (
        sale.orderStatus !== "APPROVED" &&
        sale.orderStatus !== "SHIPPING" &&
        !canTransitionOrderStatus(sale.orderStatus, "SHIPPING")
      ) {
        skippedCount += 1;
        errors.push(
          `${sale.saleNo}: Kargo bilgisi yalnızca onaylı veya kargodaki siparişlere eklenebilir.`
        );
        continue;
      }

      const nextStatus =
        sale.orderStatus === "SHIPPING" ? "SHIPPING" : "SHIPPING";

      if (
        sale.orderStatus !== "SHIPPING" &&
        !canTransitionOrderStatus(sale.orderStatus, nextStatus)
      ) {
        skippedCount += 1;
        errors.push(`${sale.saleNo}: Kargoya verilemez.`);
        continue;
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          shippingCarrier: shippingValidation.shippingCarrier,
          trackingNumber: shippingValidation.trackingNumber,
          shippedAt,
          orderStatus: "SHIPPING",
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "UPDATE",
          module: "orders",
          message: `${sale.saleNo} siparişine kargo bilgisi eklendi (${shippingValidation.shippingCarrier}, ${shippingValidation.trackingNumber}).`,
        },
      });

      updatedCount += 1;
    }
  });

  return {
    ok: true as const,
    data: {
      updatedCount,
      skippedCount,
      errors,
    },
  };
}
