import { z } from "zod";
import { AdminPartnerServiceError } from "@/lib/admin/partners/admin-partner-errors";

const forbiddenCreateKeys = [
  "partnerId",
  "id",
  "status",
  "earnings",
  "companyCount",
  "clicks",
  "signups",
  "paidTotal",
] as const;

const forbiddenPatchKeys = [
  "partnerId",
  "id",
  "status",
  "earnings",
  "companyCount",
  "clicks",
  "signups",
  "paidTotal",
  "payout",
  "payouts",
] as const;

export const adminPartnerCreateSchema = z
  .object({
    fullName: z.string().min(2).max(200),
    referralCode: z.string().min(3).max(32).optional(),
    email: z.string().email(),
    phone: z.string().max(40).optional().nullable(),
    accountHolderName: z.string().max(200).optional().nullable(),
    taxNumber: z.string().max(32).optional().nullable(),
    iban: z.string().max(34).optional().nullable(),
    bankName: z.string().max(120).optional().nullable(),
    badgeType: z
      .enum(["NONE", "PARTNER", "VERIFIED", "INFLUENCER", "CELEBRITY", "VIP"])
      .default("PARTNER"),
    badgeLabel: z.string().max(80).optional().nullable(),
    commissionRate: z.number().min(0).max(100),
    payoutMethod: z.enum(["IBAN", "MANUAL", "OTHER"]).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    reason: z.string().max(2000).optional(),
  })
  .strict();

export const adminPartnerUpdateSchema = z
  .object({
    fullName: z.string().min(2).max(200).optional(),
    referralCode: z.string().min(3).max(32).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(40).optional().nullable(),
    accountHolderName: z.string().max(200).optional().nullable(),
    taxNumber: z.string().max(32).optional().nullable(),
    iban: z.string().max(34).optional().nullable(),
    bankName: z.string().max(120).optional().nullable(),
    badgeType: z
      .enum(["NONE", "PARTNER", "VERIFIED", "INFLUENCER", "CELEBRITY", "VIP"])
      .optional(),
    badgeLabel: z.string().max(80).optional().nullable(),
    commissionRate: z.number().min(0).max(100).optional(),
    payoutMethod: z.enum(["IBAN", "MANUAL", "OTHER"]).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    reason: z.string().max(2000).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "En az bir alan gerekli.");

export const adminPartnerLifecycleSchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminPartnerNoteCreateSchema = z
  .object({
    content: z.string().min(1).max(10000),
    category: z
      .enum(["GENERAL", "BILLING", "RISK", "SUPPORT", "TECHNICAL", "ENTITLEMENT"])
      .default("GENERAL"),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    isPinned: z.boolean().optional(),
  })
  .strict();

export const adminPartnerNotePatchSchema = adminPartnerNoteCreateSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  "En az bir alan gerekli."
);

export function assertNoForbiddenPartnerCreateKeys(body: Record<string, unknown>) {
  for (const key of forbiddenCreateKeys) {
    if (key in body) {
      throw new AdminPartnerServiceError(`"${key}" partner oluşturma isteğinde kabul edilmez.`);
    }
  }
}

export function assertNoForbiddenPartnerPatchKeys(body: Record<string, unknown>) {
  if ("status" in body) {
    throw new AdminPartnerServiceError("Partner durumu generic PATCH ile değiştirilemez.");
  }
  for (const key of forbiddenPatchKeys) {
    if (key in body) {
      throw new AdminPartnerServiceError(`"${key}" güncelleme isteğinde kabul edilmez.`);
    }
  }
}
