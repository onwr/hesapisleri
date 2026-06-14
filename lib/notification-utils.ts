import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  Prisma,
} from "@prisma/client";

export type NotificationTab = "all" | "unread" | "read";

export type NormalizedNotification = {
  id: string;
  companyId: string;
  userId: string | null;
  type: NotificationType;
  category: NotificationCategory;
  module: string | null;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  priority: NotificationPriority;
  channel: NotificationChannel;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
};

export type NotificationSummary = {
  unread: number;
  today: number;
  critical: number;
  high: number;
  byCategory: Array<{ category: NotificationCategory; count: number }>;
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "SALES",
  "INVOICES",
  "STOCK",
  "FINANCE",
  "SYSTEM",
  "TEAM",
  "MARKETPLACE",
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "CRITICAL",
];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> =
  {
    SALES: "Satış",
    INVOICES: "Fatura",
    STOCK: "Stok",
    FINANCE: "Finans",
    SYSTEM: "Sistem",
    TEAM: "Ekip",
    MARKETPLACE: "Pazaryeri",
  };

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> =
  {
    LOW: "Düşük",
    NORMAL: "Normal",
    HIGH: "Yüksek",
    CRITICAL: "Kritik",
  };

const SENSITIVE_METADATA_KEYS =
  /secret|token|password|apikey|api_key|credential|authorization/i;

export function formatUnreadBadge(count: number) {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}

export function parseNotificationTab(value?: string | null): NotificationTab {
  if (value === "unread" || value === "read") return value;
  return "all";
}

export function parseNotificationCategory(
  value?: string | null
): NotificationCategory | undefined {
  if (!value) return undefined;
  return NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
    ? (value as NotificationCategory)
    : undefined;
}

export function parseNotificationPriority(
  value?: string | null
): NotificationPriority | undefined {
  if (!value) return undefined;
  return NOTIFICATION_PRIORITIES.includes(value as NotificationPriority)
    ? (value as NotificationPriority)
    : undefined;
}

export function parseNotificationLimit(value?: string | null, max = 50) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed) || parsed < 1) return 20;
  return Math.min(Math.floor(parsed), max);
}

export function buildNotificationSearchFilter(
  search?: string | null
): Prisma.NotificationWhereInput | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  return {
    OR: [
      { title: { contains: term, mode: "insensitive" } },
      { message: { contains: term, mode: "insensitive" } },
    ],
  };
}

export function buildNotificationUserScope(userId: string): Prisma.NotificationWhereInput {
  return {
    OR: [{ userId }, { userId: null }],
  };
}

export function buildNotificationTabFilter(
  tab: NotificationTab
): Prisma.NotificationWhereInput | undefined {
  if (tab === "unread") return { readAt: null };
  if (tab === "read") return { readAt: { not: null } };
  return undefined;
}

export function sanitizeNotificationMetadata(
  metadata: Prisma.JsonValue | null | undefined
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.test(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeNotificationMetadata(value as Prisma.JsonValue);
      continue;
    }
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function serializeNotification(
  notification: {
    id: string;
    companyId: string;
    userId: string | null;
    type: NotificationType;
    category: NotificationCategory;
    module: string | null;
    entityType: string | null;
    entityId: string | null;
    actionUrl: string | null;
    metadata: Prisma.JsonValue | null;
    priority: NotificationPriority;
    channel: NotificationChannel;
    title: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }
): NormalizedNotification {
  return {
    id: notification.id,
    companyId: notification.companyId,
    userId: notification.userId,
    type: notification.type,
    category: notification.category,
    module: notification.module,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionUrl: notification.actionUrl,
    metadata: sanitizeNotificationMetadata(notification.metadata),
    priority: notification.priority,
    channel: notification.channel,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    isRead: notification.readAt != null,
  };
}

export function resolveShouldNotifyFromSettings(
  settings: {
    notifyLowStock: boolean;
    notifyDueInvoices: boolean;
    notifyLateCollections: boolean;
    notifyDailySummary: boolean;
    notifyEmployeePayments: boolean;
  } | null,
  input: {
    isProactive?: boolean;
    category?: NotificationCategory;
    dedupeKey?: string | null;
  }
) {
  if (!input.isProactive) return true;
  if (!settings) return true;

  const dedupeKey = input.dedupeKey ?? "";

  if (
    input.category === "STOCK" ||
    dedupeKey.startsWith("low-stock:")
  ) {
    return settings.notifyLowStock;
  }

  if (
    input.category === "INVOICES" ||
    dedupeKey.startsWith("due-invoice:")
  ) {
    return settings.notifyDueInvoices;
  }

  if (
    input.category === "FINANCE" ||
    dedupeKey.startsWith("late-collection:")
  ) {
    return settings.notifyLateCollections;
  }

  if (dedupeKey.startsWith("daily-summary:")) {
    return settings.notifyDailySummary;
  }

  if (dedupeKey.startsWith("employee-payment-due:")) {
    return settings.notifyEmployeePayments;
  }

  return true;
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function buildNotificationListQuery(input: {
  tab?: string | null;
  category?: string | null;
  priority?: string | null;
  search?: string | null;
  limit?: string | null;
}) {
  return {
    tab: parseNotificationTab(input.tab),
    category: parseNotificationCategory(input.category),
    priority: parseNotificationPriority(input.priority),
    search: input.search?.trim() || undefined,
    limit: parseNotificationLimit(input.limit),
  };
}
