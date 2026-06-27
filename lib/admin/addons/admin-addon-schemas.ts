import { z } from "zod";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";

const forbiddenCreateKeys = [
  "status",
  "active",
  "addOnId",
  "id",
  "archivedAt",
  "subscriptionCount",
  "finalPriceMinor",
  "resolvedEntitlement",
] as const;

export const adminAddonCreateSchema = z
  .object({
    name: z.string().min(2).max(200),
    code: z.string().min(2).max(64),
    slug: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    type: z.enum(["RECURRING", "ONE_TIME", "USAGE_PACK"]),
    entitlementCode: z.string().min(1),
    entitlementQuantity: z.number().int().positive(),
    currency: z.enum(["TRY", "USD", "EUR"]).default("TRY"),
    vatRate: z.number().int().min(0).max(100).optional(),
    vatIncluded: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    recurringAllowed: z.boolean().optional(),
    prorationAllowed: z.boolean().optional(),
    carryOver: z.boolean().optional(),
    expiresAfterDays: z.number().int().positive().optional().nullable(),
    prerequisiteCodes: z.array(z.string()).max(20).optional(),
    reason: z.string().max(2000).optional(),
    initialPrice: z
      .object({
        billingInterval: z
          .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])
          .optional()
          .nullable(),
        listPriceMinor: z.number().int().min(0),
        salePriceMinor: z.number().int().min(0),
        currency: z.enum(["TRY", "USD", "EUR"]).optional(),
        vatRate: z.number().int().min(0).max(100).optional(),
        vatIncluded: z.boolean().optional(),
        effectiveFrom: z.string().datetime().optional(),
      })
      .optional(),
  })
  .strict();

export const adminAddonOverviewEditSchema = z
  .object({
    name: z.string().min(2).max(200),
    description: z.string().max(5000).optional().nullable(),
    sortOrder: z.number().int().min(0),
    type: z.enum(["RECURRING", "ONE_TIME", "USAGE_PACK"]).optional(),
    entitlementCode: z.string().min(1),
    entitlementQuantity: z.number().int().positive(),
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const adminAddonUpdateSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    type: z.enum(["RECURRING", "ONE_TIME", "USAGE_PACK"]).optional(),
    entitlementCode: z.string().min(1).optional(),
    entitlementQuantity: z.number().int().positive().optional(),
    currency: z.enum(["TRY", "USD", "EUR"]).optional(),
    vatRate: z.number().int().min(0).max(100).optional(),
    vatIncluded: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    recurringAllowed: z.boolean().optional(),
    prorationAllowed: z.boolean().optional(),
    carryOver: z.boolean().optional(),
    expiresAfterDays: z.number().int().positive().optional().nullable(),
    prerequisiteCodes: z.array(z.string()).max(20).optional(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "En az bir alan gerekli.");

export const adminAddonActivateSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminAddonArchiveSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminAddonPriceCreateSchema = z
  .object({
    billingInterval: z
      .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])
      .optional()
      .nullable(),
    listPriceMinor: z.number().int().min(0),
    salePriceMinor: z.number().int().min(0),
    currency: z.enum(["TRY", "USD", "EUR"]),
    vatRate: z.number().int().min(0).max(100).optional(),
    vatIncluded: z.boolean().optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveUntil: z.string().datetime().optional().nullable(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const adminAddonPricePublishSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminAddonPreviewSchema = z
  .object({
    quantity: z.number().int().positive().max(100).default(1),
    billingInterval: z
      .enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"])
      .optional()
      .nullable(),
    currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  })
  .strict();

export function assertNoForbiddenAddonCreateKeys(body: Record<string, unknown>) {
  for (const key of forbiddenCreateKeys) {
    if (key in body) {
      throw new AddOnServiceError(`"${key}" add-on oluşturma isteğinde kabul edilmez.`);
    }
  }
}

export function assertNoForbiddenAddonPatchKeys(body: Record<string, unknown>) {
  if ("status" in body) {
    throw new AddOnServiceError("Add-on durumu generic PATCH ile değiştirilemez.");
  }
  for (const key of [
    "addOnId",
    "id",
    "code",
    "active",
    "isActive",
    "subscriptionCount",
    "finalPriceMinor",
    "resolvedEntitlement",
    "listPriceMinor",
    "salePriceMinor",
    "prices",
  ] as const) {
    if (key in body) {
      throw new AddOnServiceError(`"${key}" güncelleme isteğinde kabul edilmez.`);
    }
  }
}

export function buildAddonOverviewPatchBody(
  input: z.infer<typeof adminAddonOverviewEditSchema>,
  options: { isDraft: boolean; currentType: string }
) {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? null,
    sortOrder: input.sortOrder,
    entitlementCode: input.entitlementCode,
    entitlementQuantity: input.entitlementQuantity,
    reason: input.reason,
  };
  if (options.isDraft && input.type !== undefined && input.type !== options.currentType) {
    body.type = input.type;
  }
  return body;
}

export function assertAddonTypeEditAllowed(isDraft: boolean, body: Record<string, unknown>) {
  if ("type" in body && !isDraft) {
    throw new AddOnServiceError("Tür yalnızca taslak add-on için değiştirilebilir.", 400);
  }
}
