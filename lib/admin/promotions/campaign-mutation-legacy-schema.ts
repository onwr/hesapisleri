import { z } from "zod";

/** @deprecated use adminCampaignCreateSchema — kept for backward-compatible imports */
export const createCampaignSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  internalNote: z.string().optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "OVERRIDE_PRICE"]),
  discountValue: z.number().int().positive(),
  overridePriceMinor: z.number().int().positive().optional().nullable(),
  minimumAmountMinor: z.number().int().min(0).optional().nullable(),
  currency: z.string().default("TRY"),
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
  priority: z.number().int().optional(),
  scopes: z
    .array(
      z.object({
        planId: z.string().optional().nullable(),
        billingInterval: z
          .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])
          .optional()
          .nullable(),
        companyId: z.string().optional().nullable(),
        partnerId: z.string().optional().nullable(),
        firstPaymentOnly: z.boolean().optional(),
        renewalAllowed: z.boolean().optional(),
      })
    )
    .optional(),
});
