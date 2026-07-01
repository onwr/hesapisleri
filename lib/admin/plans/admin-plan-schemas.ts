import { z } from "zod";

const forbiddenPatchKeys = [
  "planStatus",
  "isActive",
  "publishedAt",
  "archivedAt",
  "monthlyPrice",
  "quarterlyPrice",
  "semiAnnualPrice",
  "yearlyPrice",
  "currency",
  "defaultCurrency",
  "vatRate",
  "vatIncluded",
  "visibility",
  "features",
] as const;

export const adminPlanMetadataPatchSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    shortDescription: z.string().max(500).nullable().optional(),
    badgeText: z.string().max(100).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    trialEnabled: z.boolean().optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    autoRenewAllowed: z.boolean().optional(),
    upgradeAllowed: z.boolean().optional(),
    downgradeAllowed: z.boolean().optional(),
    cancellationAllowed: z.boolean().optional(),
    gracePeriodDays: z.number().int().min(0).max(90).optional(),
    isFeatured: z.boolean().optional(),
    code: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
    slug: z.string().min(2).max(128).regex(/^[a-z0-9-]+$/).optional(),
  })
  .strict();

export type AdminPlanMetadataPatch = z.infer<typeof adminPlanMetadataPatchSchema>;

export function assertNoForbiddenPlanPatchKeys(body: Record<string, unknown>) {
  for (const key of forbiddenPatchKeys) {
    if (key in body) {
      throw new AdminPlanPatchValidationError(
        `"${key}" generic PATCH ile güncellenemez. Lifecycle ve fiyat işlemleri için özel servisleri kullanın.`,
        key
      );
    }
  }
  const unknown = Object.keys(body).filter(
    (k) => !(adminPlanMetadataPatchSchema.keyof().options as string[]).includes(k)
  );
  if (unknown.length > 0) {
    throw new AdminPlanPatchValidationError(
      `Bilinmeyen alanlar: ${unknown.join(", ")}`,
      unknown[0]
    );
  }
}

export class AdminPlanPatchValidationError extends Error {
  field?: string;
  status = 400;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "AdminPlanPatchValidationError";
    this.field = field;
  }
}

export const adminPlanListQuerySchema = z.object({
  q: z.string().optional(),
  planStatus: z.enum(["ALL", "DRAFT", "ACTIVE", "ARCHIVED"]).default("ALL"),
  visibility: z.enum(["ALL", "PUBLIC", "PRIVATE", "INTERNAL"]).default("ALL"),
  pricingClass: z.enum(["ALL", "FREE", "PAID", "MIXED", "UNCONFIGURED"]).default("ALL"),
  checkout: z.enum(["ALL", "AVAILABLE", "UNAVAILABLE"]).default("ALL"),
  issue: z.string().optional(),
  sortBy: z
    .enum(["name", "code", "sortOrder", "planStatus", "createdAt", "updatedAt"])
    .default("sortOrder"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(25).max(100).default(25),
});

export type AdminPlanListQuery = z.infer<typeof adminPlanListQuerySchema>;

export const adminPlanActivateSchema = z.object({
  reason: z.string().min(1).max(2000),
  confirm: z.literal(true),
});

export const adminPlanArchiveSchema = z.object({
  reason: z.string().min(1).max(2000),
  confirmActiveSubscriptions: z.boolean().default(false),
  confirm: z.literal(true),
});

export const adminPlanPricePreviewInputSchema = z.object({
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  currency: z.string().min(3).max(3).optional(),
  listPrice: z.union([z.string(), z.number()]),
  salePrice: z.union([z.string(), z.number()]),
  listPriceMinor: z.number().int().min(0).optional(),
  salePriceMinor: z.number().int().min(0).optional(),
  vatRate: z.number().int().min(0).max(100).optional(),
  vatIncluded: z.boolean().optional(),
  effectiveFrom: z.string().datetime().or(z.string().min(1)),
  effectiveUntil: z.string().datetime().nullable().optional(),
  priceChangePolicy: z.enum([
    "NEW_SUBSCRIBERS_ONLY",
    "NEXT_RENEWAL",
    "AFTER_DATE",
    "GRANDFATHERED",
  ]),
  isPublic: z.boolean().default(true),
  isAutoRenewEnabled: z.boolean().default(true),
  reason: z.string().max(2000).optional(),
});

export const adminPlanPricePublishSchema = z.object({
  previewToken: z.string().min(10),
  reason: z.string().min(1).max(2000),
  price: adminPlanPricePreviewInputSchema,
});

export const adminPlanPricePatchSchema = adminPlanPricePreviewInputSchema
  .partial()
  .extend({
    adminNote: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Güncellenecek en az bir alan gerekli.",
  });

export type AdminPlanPricePatchInput = z.infer<typeof adminPlanPricePatchSchema>;

export type AdminPlanPricePreviewInput = z.infer<typeof adminPlanPricePreviewInputSchema>;

export type AdminPlanTab =
  | "overview"
  | "pricing"
  | "features"
  | "entitlements"
  | "subscriptions"
  | "history"
  | "activity"
  | "notes";

export function resolvePlanTab(raw: string | undefined): AdminPlanTab {
  const tabs: AdminPlanTab[] = [
    "overview",
    "pricing",
    "features",
    "entitlements",
    "subscriptions",
    "history",
    "activity",
    "notes",
  ];
  if (raw && (tabs as string[]).includes(raw)) return raw as AdminPlanTab;
  return "overview";
}

const entitlementRowSchema = z
  .object({
    code: z.string().min(1).max(64),
    valueType: z.enum(["BOOLEAN", "NUMBER", "UNLIMITED", "STRING"]),
    booleanValue: z.boolean().nullable().optional(),
    numberValue: z.number().nullable().optional(),
    stringValue: z.string().max(500).nullable().optional(),
    isUnlimited: z.boolean().optional(),
    description: z.string().max(500).nullable().optional(),
    category: z.string().max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

export const adminPlanEntitlementPreviewSchema = z
  .object({
    entitlements: z.array(entitlementRowSchema),
    baseVersion: z.number().int().min(0),
  })
  .strict();

export const adminPlanEntitlementPublishSchema = z
  .object({
    entitlements: z.array(entitlementRowSchema),
    baseVersion: z.number().int().min(0),
    reason: z.string().min(1).max(2000),
    changePolicy: z
      .enum(["NEW_SUBSCRIBERS_ONLY", "IMMEDIATE", "NEXT_RENEWAL", "GRANDFATHERED"])
      .optional(),
  })
  .strict();

export const adminPlanSubscriptionQuerySchema = z.object({
  q: z.string().optional(),
  status: z
    .enum([
      "ALL",
      "TRIAL",
      "ACTIVE",
      "PAST_DUE",
      "GRACE_PERIOD",
      "CANCEL_AT_PERIOD_END",
      "CANCELLED",
      "EXPIRED",
      "SUSPENDED",
    ])
    .default("ALL"),
  billingInterval: z.enum(["ALL", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).default("ALL"),
  currency: z.string().max(3).optional(),
  companyId: z.string().optional(),
  priceLockType: z
    .enum(["ALL", "NEW_SUBSCRIBERS_ONLY", "NEXT_RENEWAL", "AFTER_DATE", "GRANDFATHERED"])
    .default("ALL"),
  grandfathered: z.enum(["ALL", "YES", "NO"]).default("ALL"),
  locked: z.enum(["ALL", "LOCKED", "UNLOCKED"]).default("ALL"),
  hasNextPrice: z.enum(["ALL", "YES", "NO"]).default("ALL"),
  issue: z.string().optional(),
  periodStartFrom: z.string().optional(),
  periodStartTo: z.string().optional(),
  periodEndFrom: z.string().optional(),
  periodEndTo: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "companyName", "status", "currentPeriodEnd", "monthlyRevenue"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  subscriptionsPage: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n), "Geçersiz sayfa boyutu").default(25),
});

export type AdminPlanSubscriptionQuery = z.infer<typeof adminPlanSubscriptionQuerySchema>;

export const adminPlanHistoryQuerySchema = z.object({
  eventType: z.string().optional(),
  source: z.enum(["ALL", "AUDIT", "MODEL", "ACTIVITY"]).default("ALL"),
  adminUserId: z.string().optional(),
  category: z.enum(["ALL", "PRICE", "FEATURE", "ENTITLEMENT", "LIFECYCLE", "NOTE"]).default("ALL"),
  success: z.enum(["ALL", "SUCCESS", "ERROR"]).default("ALL"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  historyPage: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).default(25),
});

export type AdminPlanHistoryQuery = z.infer<typeof adminPlanHistoryQuerySchema>;

export const adminPlanActivityQuerySchema = z.object({
  action: z.string().optional(),
  module: z.string().optional(),
  adminUserId: z.string().optional(),
  success: z.enum(["ALL", "SUCCESS", "ERROR"]).default("ALL"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  activityPage: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n)).default(25),
});

export type AdminPlanActivityQuery = z.infer<typeof adminPlanActivityQuerySchema>;

const forbiddenCreateKeys = [
  ...forbiddenPatchKeys,
  "planId",
  "id",
  "slug",
  "isFeatured",
  "autoRenewAllowed",
  "upgradeAllowed",
  "downgradeAllowed",
  "cancellationAllowed",
  "gracePeriodDays",
  "badgeText",
  "shortDescription",
] as const;

export const adminPlanCreateFeatureSchema = z
  .object({
    title: z.string().min(1).max(200).transform((s) => s.trim()),
    shortDescription: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length ? t : null;
      }),
    iconKey: z.string().max(64).nullable().optional(),
    sortOrder: z.number().int().min(0).max(9999).default(100),
    isHighlighted: z.boolean().default(false),
    isVisible: z.boolean().default(true),
  })
  .strict();

export const adminPlanCreateSchema = z
  .object({
    name: z.string().min(2).max(200).transform((s) => s.trim()),
    code: z.string().min(2).max(64),
    description: z
      .string()
      .max(5000)
      .nullable()
      .optional()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length ? t : null;
      }),
    sortOrder: z.number().int().min(0).max(9999).default(100),
    trialEnabled: z.boolean().default(true),
    trialDays: z.number().int().min(0).max(365).default(14),
    defaultCurrency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
    visibility: z.enum(["INTERNAL", "PRIVATE"]).default("INTERNAL"),
    features: z.array(adminPlanCreateFeatureSchema).max(50).default([]),
    entitlements: z.array(entitlementRowSchema).max(100).default([]),
    clientRequestId: z.string().min(8).max(64).optional(),
  })
  .strict();

export type AdminPlanCreateInput = z.infer<typeof adminPlanCreateSchema>;

export const adminPlanCloneSchema = z
  .object({
    name: z.string().min(2).max(200).transform((s) => s.trim()),
    code: z.string().min(2).max(64),
    description: z
      .string()
      .max(5000)
      .nullable()
      .optional()
      .transform((v) => {
        if (v == null) return null;
        const t = v.trim();
        return t.length ? t : null;
      }),
    copyFeatures: z.boolean().default(true),
    copyEntitlements: z.boolean().default(true),
    copyPricesAsDraft: z.boolean().default(false),
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export type AdminPlanCloneInput = z.infer<typeof adminPlanCloneSchema>;

export function assertNoForbiddenPlanCreateKeys(body: Record<string, unknown>) {
  for (const key of forbiddenCreateKeys) {
    if (key in body) {
      throw new AdminPlanPatchValidationError(
        `"${key}" plan oluşturma isteğinde kabul edilmez.`,
        key
      );
    }
  }
}

export const ADMIN_PLAN_NOTE_CATEGORIES = [
  "GENERAL",
  "PRICING",
  "LIFECYCLE",
  "ENTITLEMENT",
  "BILLING",
  "RISK",
  "SUPPORT",
  "TECHNICAL",
] as const;

export const adminPlanNoteCreateSchema = z
  .object({
    content: z.string().min(1).max(10000).transform((s) => s.trim()),
    category: z.enum(ADMIN_PLAN_NOTE_CATEGORIES).default("GENERAL"),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    isPinned: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.content.length >= 1, "Not içeriği boş olamaz.");

export const adminPlanNotePatchSchema = z
  .object({
    content: z.string().min(1).max(10000).transform((s) => s.trim()).optional(),
    category: z.enum(ADMIN_PLAN_NOTE_CATEGORIES).optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "En az bir alan gerekli.");
