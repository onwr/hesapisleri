import { z } from "zod";
import { PricePreviewServiceError } from "@/lib/admin/price-preview/admin-price-preview-errors";

const forbiddenPreviewKeys = [
  "planPriceMinor",
  "listPriceMinor",
  "salePriceMinor",
  "discountAmount",
  "discountAmountMinor",
  "vatMinor",
  "vatAmount",
  "finalTotal",
  "finalPriceMinor",
  "totalMinor",
  "monthlyEquivalent",
  "monthlyEquivalentMinor",
  "eligible",
  "priceSource",
] as const;

export const adminPricePreviewAddOnSchema = z
  .object({
    addOnId: z.string().uuid(),
    quantity: z.number().int().positive().max(100),
  })
  .strict();

export const adminPricePreviewScenarioInputSchema = z
  .object({
    effectiveDate: z.string().datetime(),
    planId: z.string().uuid(),
    billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
    currency: z.enum(["TRY", "USD", "EUR"]).optional(),
    scenario: z.enum(["NEW_SUBSCRIPTION", "RENEWAL", "PLAN_CHANGE"]),
    companyId: z.string().uuid().optional().nullable(),
    subscriptionId: z.string().uuid().optional().nullable(),
    couponCode: z.string().max(64).optional().nullable(),
    campaignId: z.string().uuid().optional().nullable(),
    addOns: z.array(adminPricePreviewAddOnSchema).max(20).optional(),
    planChangeApplyAt: z.enum(["IMMEDIATELY", "NEXT_PERIOD"]).optional(),
  })
  .strict();

export const adminPricePreviewRequestSchema = adminPricePreviewScenarioInputSchema
  .extend({
    compareWith: adminPricePreviewScenarioInputSchema.optional(),
  })
  .strict();

export function assertNoForbiddenPreviewPriceKeys(body: Record<string, unknown>) {
  for (const key of forbiddenPreviewKeys) {
    if (key in body) {
      throw new PricePreviewServiceError(
        `"${key}" istemci fiyat alanı olarak kabul edilmez; sunucu yeniden hesaplar.`,
        400
      );
    }
  }
}
