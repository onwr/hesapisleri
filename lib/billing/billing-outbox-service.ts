import "server-only";

import type { BillingOutboxEventType, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { buildBillingNotification } from "@/lib/billing/billing-outbox-notifications";

type Tx = Prisma.TransactionClient;

export async function enqueueBillingOutboxEvent(
  input: {
    companyId: string;
    type: BillingOutboxEventType;
    aggregateType: string;
    aggregateId: string;
    payload: Prisma.InputJsonValue;
    availableAt?: Date;
  },
  tx: Tx | typeof db = db
) {
  return tx.billingOutboxEvent.create({
    data: {
      companyId: input.companyId,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      availableAt: input.availableAt ?? new Date(),
    },
  });
}

export async function processBillingOutboxBatch(limit = 25) {
  const events = await db.billingOutboxEvent.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { availableAt: "asc" },
    take: limit,
  });

  for (const event of events) {
    try {
      await db.billingOutboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });

      const notification = buildBillingNotification(event.type, event.aggregateId);
      if (notification) {
        await createNotification({
          companyId: event.companyId,
          type: notification.type,
          category: "SYSTEM",
          module: "settings",
          entityType: event.aggregateType,
          entityId: event.aggregateId,
          actionUrl: "/settings/billing",
          dedupeKey: `${event.companyId}:${event.type}:${event.aggregateId}`,
          title: notification.title,
          message: notification.message,
        });
      }

      await db.billingOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await db.billingOutboxEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : "Outbox işlenemedi.",
        },
      });
    }
  }

  return { processed: events.length };
}
