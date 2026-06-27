import { z } from "zod";

export const adminSubListQuerySchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(["ALL", "TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END", "EXPIRED", "CANCELLED", "SUSPENDED"])
    .default("ALL"),
  planId: z.string().optional(),
  billingInterval: z.enum(["ALL", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).default("ALL"),
  provider: z.enum(["ALL", "PAYTR", "MANUAL", "LEGACY"]).default("ALL"),
  paymentStatus: z
    .enum(["ALL", "LAST_SUCCESS", "PENDING", "FAILED", "REFUNDED", "NONE"])
    .default("ALL"),
  issue: z.string().optional(),
  dateRange: z
    .enum(["ALL", "TODAY", "LAST_7D", "LAST_30D", "THIS_MONTH"])
    .default("ALL"),
  sortBy: z
    .enum(["createdAt", "companyName", "planName", "status", "currentPeriodEnd", "trialEndsAt", "lastPaymentAt", "monthlyRevenue"])
    .default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

export type AdminSubListQuery = z.infer<typeof adminSubListQuerySchema>;

export const extendTrialAdminSchema = z.object({
  days: z.number().int().min(1).max(90),
  reason: z.string().min(3).max(500),
  customDate: z.string().datetime().optional(),
});

export const previewPlanChangeSchema = z.object({
  targetPlanId: z.string().min(1),
  targetBillingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  applyAt: z.enum(["IMMEDIATELY", "NEXT_PERIOD"]).default("NEXT_PERIOD"),
});

export const applyPlanChangeSchema = z.object({
  previewHash: z.string().min(1),
  targetPlanId: z.string().min(1),
  targetBillingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  applyAt: z.enum(["IMMEDIATELY", "NEXT_PERIOD"]).default("NEXT_PERIOD"),
  reason: z.string().min(3).max(500),
});

export const scheduleCancellationSchema = z.object({
  reason: z.string().min(3).max(500),
  internalNote: z.string().max(1000).optional(),
  notifyUser: z.boolean().default(false),
});

export const revokeCancellationSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const syncProviderSchema = z.object({
  force: z.boolean().default(false),
});

export const adminSubNoteCreateSchema = z.object({
  content: z.string().min(1).max(5000),
  category: z
    .enum(["GENERAL", "BILLING", "PAYMENT", "RETENTION", "RISK", "SUPPORT", "TECHNICAL"])
    .default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPinned: z.boolean().default(false),
});

export const adminSubNoteUpdateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  category: z
    .enum(["GENERAL", "BILLING", "PAYMENT", "RETENTION", "RISK", "SUPPORT", "TECHNICAL"])
    .optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  isPinned: z.boolean().optional(),
});
