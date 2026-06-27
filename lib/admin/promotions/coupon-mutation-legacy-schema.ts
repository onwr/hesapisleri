import { z } from "zod";

/** @deprecated use adminCouponCreateSchema */
export const createCouponSchema = z.object({
  code: z.string().min(3).max(32),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
  discountValue: z.number().int().positive(),
  overridePriceMinor: z.number().int().positive().optional().nullable(),
  currency: z.string().default("TRY"),
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
  planIds: z.array(z.string()).optional(),
  activate: z.boolean().optional(),
});
