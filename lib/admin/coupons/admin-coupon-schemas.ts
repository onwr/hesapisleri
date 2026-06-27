import { z } from "zod";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";

const forbiddenCreateKeys = [
  "status",
  "usageCount",
  "finalPriceMinor",
  "totalDiscountMinor",
  "calculatedDiscountMinor",
  "couponId",
  "id",
  "archivedAt",
  "activate",
] as const;

export const adminCouponCreateSchema = z
  .object({
    code: z.string().min(3).max(32),
    name: z.string().min(2).max(200),
    description: z.string().max(5000).optional().nullable(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
    discountValue: z.number().int().positive(),
    overridePriceMinor: z.number().int().positive().optional().nullable(),
    currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional().nullable(),
    maxUsage: z.number().int().positive().optional().nullable(),
    maxUsagePerCompany: z.number().int().positive().optional(),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    firstPaymentOnly: z.boolean().optional(),
    renewalAllowed: z.boolean().optional(),
    newCustomersOnly: z.boolean().optional(),
    stackable: z.boolean().optional(),
    allowedIntervals: z
      .array(z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]))
      .optional(),
    planIds: z.array(z.string()).max(50).optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const adminCouponUpdateSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]).optional(),
    discountValue: z.number().int().positive().optional(),
    overridePriceMinor: z.number().int().positive().optional().nullable(),
    currency: z.enum(["TRY", "USD", "EUR"]).optional(),
    startsAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    maxUsage: z.number().int().positive().optional().nullable(),
    maxUsagePerCompany: z.number().int().positive().optional(),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    firstPaymentOnly: z.boolean().optional(),
    renewalAllowed: z.boolean().optional(),
    newCustomersOnly: z.boolean().optional(),
    stackable: z.boolean().optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "En az bir alan gerekli.");

export const adminCouponTargetingSchema = z
  .object({
    planIds: z.array(z.string()).max(50),
    allowedIntervals: z.array(z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])),
    currency: z.enum(["TRY", "USD", "EUR"]),
    minimumAmountMinor: z.number().int().min(0).optional().nullable(),
    maxUsage: z.number().int().positive().optional().nullable(),
    maxUsagePerCompany: z.number().int().positive(),
    newCustomersOnly: z.boolean(),
    firstPaymentOnly: z.boolean(),
    renewalAllowed: z.boolean(),
    stackable: z.boolean(),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const adminCouponActivateSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminCouponArchiveSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminCouponPreviewSchema = z
  .object({
    companyId: z.string().min(1),
    planId: z.string().min(1),
    billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
    isRenewal: z.boolean().optional(),
  })
  .strict();

export function assertNoForbiddenCouponCreateKeys(body: Record<string, unknown>) {
  for (const key of forbiddenCreateKeys) {
    if (key in body) {
      throw new PromotionError(`"${key}" kupon oluşturma isteğinde kabul edilmez.`);
    }
  }
}

export function assertNoForbiddenCouponPatchKeys(body: Record<string, unknown>) {
  if ("status" in body) {
    throw new PromotionError("Kupon durumu generic PATCH ile değiştirilemez.");
  }
  for (const key of ["usageCount", "finalPriceMinor", "couponId", "id", "code"] as const) {
    if (key in body) {
      throw new PromotionError(`"${key}" güncelleme isteğinde kabul edilmez.`);
    }
  }
}

export function assertNoForbiddenCouponTargetingKeys(body: Record<string, unknown>) {
  if ("couponId" in body) {
    throw new PromotionError("couponId hedefleme isteğinde kabul edilmez.");
  }
  if ("status" in body) {
    throw new PromotionError("Kupon durumu hedefleme ile değiştirilemez.");
  }
}
