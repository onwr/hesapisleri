import { z } from "zod";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";

const forbiddenCreateKeys = [
  "status",
  "usageCount",
  "finalPriceMinor",
  "totalDiscountMinor",
  "calculatedDiscountMinor",
  "campaignId",
  "id",
  "publishedAt",
  "pausedAt",
  "archivedAt",
  "publish",
] as const;

const scopeSchema = z
  .object({
    planId: z.string().optional().nullable(),
    billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).optional().nullable(),
    companyId: z.string().optional().nullable(),
    partnerId: z.string().optional().nullable(),
    firstPaymentOnly: z.boolean().optional(),
    renewalAllowed: z.boolean().optional(),
  })
  .strict();

export const adminCampaignCreateSchema = z
  .object({
    name: z.string().min(2).max(200).transform((s) => s.trim()),
    code: z.string().max(64).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    internalNote: z.string().max(2000).optional().nullable(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
    discountValue: z.number().int().positive(),
    overridePriceMinor: z.number().int().positive().optional().nullable(),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional().nullable(),
    maxRedemptions: z.number().int().positive().optional().nullable(),
    maxRedemptionsPerCompany: z.number().int().positive().optional().nullable(),
    newCustomersOnly: z.boolean().optional(),
    existingCustomersAllowed: z.boolean().optional(),
    firstPaymentOnly: z.boolean().optional(),
    renewalAllowed: z.boolean().optional(),
    autoApply: z.boolean().optional(),
    stackable: z.boolean().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
    scopes: z.array(scopeSchema).max(50).optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const adminCampaignUpdateSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    code: z.string().max(64).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    internalNote: z.string().max(2000).optional().nullable(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]).optional(),
    discountValue: z.number().int().positive().optional(),
    overridePriceMinor: z.number().int().positive().optional().nullable(),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    currency: z.enum(["TRY", "USD", "EUR"]).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().nullable(),
    maxRedemptions: z.number().int().positive().optional().nullable(),
    maxRedemptionsPerCompany: z.number().int().positive().optional().nullable(),
    newCustomersOnly: z.boolean().optional(),
    existingCustomersAllowed: z.boolean().optional(),
    firstPaymentOnly: z.boolean().optional(),
    renewalAllowed: z.boolean().optional(),
    autoApply: z.boolean().optional(),
    stackable: z.boolean().optional(),
    priority: z.number().int().min(0).max(9999).optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "En az bir alan gerekli.");

export const adminCampaignTargetingSchema = z
  .object({
    scopes: z.array(scopeSchema).max(50),
    reason: z.string().min(1).max(2000),
    currency: z.enum(["TRY", "USD", "EUR"]),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    maxRedemptions: z.number().int().positive().optional().nullable(),
    maxRedemptionsPerCompany: z.number().int().positive().optional().nullable(),
    newCustomersOnly: z.boolean(),
    existingCustomersAllowed: z.boolean(),
    firstPaymentOnly: z.boolean(),
    renewalAllowed: z.boolean(),
    autoApply: z.boolean(),
    stackable: z.boolean(),
    priority: z.number().int().min(0).max(9999),
  })
  .strict();

export function assertNoForbiddenCampaignTargetingKeys(body: Record<string, unknown>) {
  if ("campaignId" in body) {
    throw new PromotionError("campaignId hedefleme isteğinde kabul edilmez.");
  }
  if ("status" in body) {
    throw new PromotionError("Kampanya durumu hedefleme ile değiştirilemez.");
  }
  for (const key of ["usageCount", "finalPriceMinor", "id"] as const) {
    if (key in body) {
      throw new PromotionError(`"${key}" hedefleme isteğinde kabul edilmez.`);
    }
  }
}

export const adminCampaignActivateSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminCampaignArchiveSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminCampaignPreviewSchema = z
  .object({
    companyId: z.string().min(1),
    planId: z.string().min(1),
    billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
    isRenewal: z.boolean().optional(),
  })
  .strict();

export const adminCampaignListQuerySchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "EXPIRED", "ARCHIVED"])
    .optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]).optional(),
  planId: z.string().optional(),
  interval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]).optional(),
  autoApply: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "startsAt", "priority", "created"]).default("startsAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((n) => [25, 50, 100].includes(n))
    .default(25),
  issue: z.string().optional(),
});

export function assertNoForbiddenCampaignCreateKeys(body: Record<string, unknown>) {
  for (const key of forbiddenCreateKeys) {
    if (key in body) {
      throw new PromotionError(`"${key}" kampanya oluşturma isteğinde kabul edilmez.`);
    }
  }
}

export function assertNoForbiddenCampaignPatchKeys(body: Record<string, unknown>) {
  if ("status" in body) {
    throw new PromotionError("Kampanya durumu generic PATCH ile değiştirilemez.");
  }
  for (const key of ["usageCount", "finalPriceMinor", "campaignId", "id"] as const) {
    if (key in body) {
      throw new PromotionError(`"${key}" güncelleme isteğinde kabul edilmez.`);
    }
  }
}
