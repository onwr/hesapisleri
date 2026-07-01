import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  buildNotificationSearchFilter,
  buildNotificationTabFilter,
  buildNotificationUserScope,
  resolveShouldNotifyFromSettings,
  serializeNotification,
  startOfToday,
  type NormalizedNotification,
  type NotificationSummary,
  type NotificationTab,
} from "@/lib/notification-utils";

export class NotificationServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "NotificationServiceError";
    this.status = status;
  }
}

type DbClient = Prisma.TransactionClient | typeof db;

export type CreateNotificationInput = {
  companyId: string;
  userId?: string | null;
  type?: NotificationType;
  category?: NotificationCategory;
  module?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
  priority?: NotificationPriority;
  channel?: NotificationChannel;
  dedupeKey?: string | null;
  title: string;
  message: string;
  isProactive?: boolean;
};

function baseCompanyScope(companyId: string, userId: string) {
  return {
    companyId,
    ...buildNotificationUserScope(userId),
  };
}

export async function shouldNotify(input: {
  companyId: string;
  category?: NotificationCategory;
  dedupeKey?: string | null;
  isProactive?: boolean;
}) {
  if (!input.isProactive) return true;

  const settings = await db.companySettings.findUnique({
    where: { companyId: input.companyId },
    select: {
      notifyLowStock: true,
      notifyDueInvoices: true,
      notifyLateCollections: true,
      notifyDailySummary: true,
      notifyEmployeePayments: true,
    },
  });

  return resolveShouldNotifyFromSettings(settings, input);
}

export async function createNotification(
  input: CreateNotificationInput,
  client: DbClient = db
) {
  const allowed = await shouldNotify({
    companyId: input.companyId,
    category: input.category,
    dedupeKey: input.dedupeKey,
    isProactive: input.isProactive,
  });

  if (!allowed) return null;

  if (input.dedupeKey) {
    const existing = await client.notification.findFirst({
      where: {
        companyId: input.companyId,
        dedupeKey: input.dedupeKey,
      },
    });

    if (existing) {
      return serializeNotification(existing);
    }
  }

  const notification = await client.notification.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      type: input.type ?? "INFO",
      category: input.category ?? "SYSTEM",
      module: input.module ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      metadata: input.metadata ?? undefined,
      priority: input.priority ?? "NORMAL",
      channel: input.channel ?? "IN_APP",
      dedupeKey: input.dedupeKey ?? null,
      title: input.title.trim(),
      message: input.message.trim(),
    },
  });

  return serializeNotification(notification);
}

export async function createBulkNotifications(input: {
  companyId: string;
  userIds?: string[];
  broadcast?: boolean;
  notifications: Array<Omit<CreateNotificationInput, "companyId" | "userId">>;
}) {
  const created: NormalizedNotification[] = [];

  if (input.broadcast) {
    for (const item of input.notifications) {
      const notification = await createNotification({
        companyId: input.companyId,
        userId: null,
        ...item,
      });
      if (notification) created.push(notification);
    }
    return created;
  }

  const userIds = input.userIds ?? [];
  for (const userId of userIds) {
    for (const item of input.notifications) {
      const notification = await createNotification({
        companyId: input.companyId,
        userId,
        ...item,
      });
      if (notification) created.push(notification);
    }
  }

  return created;
}

export async function listNotifications(input: {
  companyId: string;
  userId: string;
  tab?: NotificationTab;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  search?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const limit = input.limit ?? 20;
  const where: Prisma.NotificationWhereInput = {
    ...baseCompanyScope(input.companyId, input.userId),
    ...buildNotificationTabFilter(input.tab ?? "all"),
  };

  if (input.category) {
    where.category = input.category;
  }

  if (input.priority) {
    where.priority = input.priority;
  }

  const searchFilter = buildNotificationSearchFilter(input.search);
  if (searchFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), searchFilter];
  }

  if (input.cursor) {
    const cursorNotification = await db.notification.findFirst({
      where: {
        id: input.cursor,
        companyId: input.companyId,
        ...buildNotificationUserScope(input.userId),
      },
    });

    if (!cursorNotification) {
      throw new NotificationServiceError("Geçersiz sayfalama imleci.", 400);
    }

    where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { createdAt: { lt: cursorNotification.createdAt } },
            {
              createdAt: cursorNotification.createdAt,
              id: { lt: cursorNotification.id },
            },
          ],
        },
      ];
  }

  const rows = await db.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    notifications: items.map(serializeNotification),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getUnreadCount(input: {
  companyId: string;
  userId: string;
}) {
  return db.notification.count({
    where: {
      ...baseCompanyScope(input.companyId, input.userId),
      readAt: null,
    },
  });
}

export async function getNotificationSummary(input: {
  companyId: string;
  userId: string;
}): Promise<NotificationSummary> {
  const scope = baseCompanyScope(input.companyId, input.userId);
  const todayStart = startOfToday();

  const [unread, today, critical, high, grouped] = await Promise.all([
    db.notification.count({ where: { ...scope, readAt: null } }),
    db.notification.count({
      where: { ...scope, createdAt: { gte: todayStart } },
    }),
    db.notification.count({
      where: { ...scope, priority: "CRITICAL", readAt: null },
    }),
    db.notification.count({
      where: { ...scope, priority: "HIGH", readAt: null },
    }),
    db.notification.groupBy({
      by: ["category"],
      where: scope,
      _count: { _all: true },
    }),
  ]);

  return {
    unread,
    today,
    critical,
    high,
    byCategory: grouped.map((item) => ({
      category: item.category,
      count: item._count._all,
    })),
  };
}

const priorityWeight: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export async function getDashboardActionNotifications(input: {
  companyId: string;
  userId: string;
  limit?: number;
}) {
  const limit = input.limit ?? 8;
  const scope = baseCompanyScope(input.companyId, input.userId);

  const rows = await db.notification.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      category: true,
      priority: true,
      actionUrl: true,
      readAt: true,
      createdAt: true,
    },
  });

  return rows
    .sort((a, b) => {
      const aUnread = a.readAt ? 0 : 1;
      const bUnread = b.readAt ? 0 : 1;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const priorityDiff =
        (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
      if (priorityDiff !== 0) return priorityDiff;

      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      type: row.type,
      category: row.category,
      priority: row.priority,
      actionUrl: row.actionUrl,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
}

export async function markAsRead(input: {
  companyId: string;
  userId: string;
  id: string;
}) {
  const existing = await db.notification.findFirst({
    where: {
      id: input.id,
      ...baseCompanyScope(input.companyId, input.userId),
    },
  });

  if (!existing) {
    throw new NotificationServiceError("Bildirim bulunamadı.", 404);
  }

  if (existing.readAt) {
    return serializeNotification(existing);
  }

  const updated = await db.notification.update({
    where: { id: existing.id },
    data: { readAt: new Date() },
  });

  return serializeNotification(updated);
}

export async function markAllAsRead(input: {
  companyId: string;
  userId: string;
}) {
  const result = await db.notification.updateMany({
    where: {
      ...baseCompanyScope(input.companyId, input.userId),
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

export async function deleteNotification(input: {
  companyId: string;
  userId: string;
  id: string;
}) {
  const existing = await db.notification.findFirst({
    where: {
      id: input.id,
      ...baseCompanyScope(input.companyId, input.userId),
    },
  });

  if (!existing) {
    return;
  }

  await db.notification.delete({ where: { id: existing.id } });
}

export type { NormalizedNotification, NotificationSummary };
