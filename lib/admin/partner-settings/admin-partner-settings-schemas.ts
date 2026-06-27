import { z } from "zod";
import { AdminPartnerSettingsServiceError } from "@/lib/admin/partner-settings/admin-partner-settings-errors";

const forbiddenUpdateKeys = ["id", "status", "createdAt", "updatedAt"] as const;

export const adminPartnerSettingsUpdateSchema = z
  .object({
    defaultCommissionRate: z.number().min(0).max(100).optional(),
    cookieDurationDays: z.number().int().min(1).max(365).optional(),
    minimumPayoutAmount: z.number().min(0).optional(),
    autoApproveConversions: z.boolean().optional(),
    commissionOnRenewals: z.boolean().optional(),
    isApplicationOpen: z.boolean().optional(),
    termsText: z.string().max(5000).nullable().optional(),
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict()
  .refine((data) => Object.keys(data).some((k) => !["reason", "confirm"].includes(k)), {
    message: "Güncellenecek en az bir ayar alanı gerekli.",
  });

export type AdminPartnerSettingsUpdateInput = z.infer<typeof adminPartnerSettingsUpdateSchema>;

export function assertNoForbiddenPartnerSettingsKeys(body: Record<string, unknown>) {
  for (const key of forbiddenUpdateKeys) {
    if (key in body) {
      throw new AdminPartnerSettingsServiceError(
        `"${key}" ayar güncelleme isteğinde kabul edilmez.`,
        400
      );
    }
  }
}
