import { z } from "zod";
import { AdminPlatformSettingsServiceError } from "@/lib/admin/platform-settings/platform-settings-errors";

const forbiddenUpdateKeys = [
  "id",
  "createdAt",
  "updatedAt",
  "updatedByUserId",
  "secret",
  "token",
  "password",
  "credential",
  "DATABASE_URL",
] as const;

const sensitivePatterns = /secret|token|password|credential|apiKey|salt|merchant/i;

export const adminPlatformSettingsUpdateSchema = z
  .object({
    version: z.number().int().min(1),
    brandName: z.string().min(2).max(120).optional(),
    supportEmail: z.string().email().max(200).optional(),
    supportPhone: z.string().max(40).nullable().optional(),
    websiteUrl: z.string().url().max(300).optional(),
    registrationEnabled: z.boolean().optional(),
    trialDays: z.number().int().min(1).max(90).optional(),
    trialAmount: z.number().min(0).max(1_000_000).optional(),
    defaultCurrency: z.enum(["TRY", "USD", "EUR"]).optional(),
    defaultVatRate: z.number().int().min(0).max(100).optional(),
    defaultNotifyLowStock: z.boolean().optional(),
    defaultNotifyDueInvoices: z.boolean().optional(),
    defaultNotifyLateCollections: z.boolean().optional(),
    defaultNotifyDailySummary: z.boolean().optional(),
    defaultNotifyEmployeePayments: z.boolean().optional(),
    maxImageBytes: z.number().int().min(256_000).max(20_971_520).optional(),
    maxTaxCertificateBytes: z.number().int().min(256_000).max(20_971_520).optional(),
    sessionMaxAgeDays: z.number().int().min(1).max(30).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().max(500).nullable().optional(),
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict()
  .refine((data) => Object.keys(data).some((k) => !["reason", "confirm", "version"].includes(k)), {
    message: "Güncellenecek en az bir ayar alanı gerekli.",
  });

export type AdminPlatformSettingsUpdateInput = z.infer<
  typeof adminPlatformSettingsUpdateSchema
>;

export function assertNoForbiddenPlatformSettingsKeys(body: Record<string, unknown>) {
  for (const key of forbiddenUpdateKeys) {
    if (key in body) {
      throw new AdminPlatformSettingsServiceError(
        `"${key}" ayar güncelleme isteğinde kabul edilmez.`,
        400
      );
    }
  }

  for (const key of Object.keys(body)) {
    if (sensitivePatterns.test(key)) {
      throw new AdminPlatformSettingsServiceError(
        `"${key}" güvenlik nedeniyle reddedildi.`,
        400
      );
    }
  }
}
