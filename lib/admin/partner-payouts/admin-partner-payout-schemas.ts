import { z } from "zod";
import { AdminPartnerPayoutServiceError } from "@/lib/admin/partner-payouts/admin-partner-payout-errors";

const forbiddenDecisionKeys = [
  "payoutId",
  "id",
  "partnerId",
  "amount",
  "total",
  "status",
  "paidAt",
  "currency",
  "markPaid",
  "paidByUserId",
  "minimumPayoutAmount",
  "threshold",
] as const;

const decisionBase = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminPartnerPayoutCreateSchema = z
  .object({
    earningIds: z.array(z.string().min(1)).min(1).max(500),
    paymentMethod: z.enum(["IBAN", "CASH", "MANUAL"]),
    note: z.string().max(2000).optional(),
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
  })
  .strict();

export const adminPartnerPayoutApproveSchema = decisionBase.strict();

export const adminPartnerPayoutRejectSchema = decisionBase.strict();

export const adminPartnerPayoutMarkPaidSchema = decisionBase
  .extend({
    paymentReference: z.string().min(1).max(200),
  })
  .strict();

export const adminPartnerPayoutNoteCreateSchema = z
  .object({
    content: z.string().min(1).max(5000),
    category: z
      .enum(["GENERAL", "BILLING", "RISK", "SUPPORT", "TECHNICAL", "ENTITLEMENT"])
      .optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
    isPinned: z.boolean().optional(),
  })
  .strict();

export const adminPartnerPayoutNotePatchSchema = z
  .object({
    content: z.string().min(1).max(5000).optional(),
    category: adminPartnerPayoutNoteCreateSchema.shape.category.optional(),
    priority: adminPartnerPayoutNoteCreateSchema.shape.priority.optional(),
    isPinned: z.boolean().optional(),
  })
  .strict();

export function assertNoForbiddenPayoutDecisionKeys(body: Record<string, unknown>) {
  for (const key of forbiddenDecisionKeys) {
    if (key in body) {
      throw new AdminPartnerPayoutServiceError(
        `"${key}" karar isteğinde kabul edilmez.`,
        400
      );
    }
  }
  if ("status" in body) {
    throw new AdminPartnerPayoutServiceError(
      "Generic status PATCH desteklenmez; özel lifecycle endpoint kullanın.",
      400
    );
  }
}

export function assertNoForbiddenPayoutCreateKeys(body: Record<string, unknown>) {
  assertNoForbiddenPayoutDecisionKeys(body);
  if ("paymentReference" in body) {
    throw new AdminPartnerPayoutServiceError(
      '"paymentReference" oluşturma isteğinde kabul edilmez.',
      400
    );
  }
}
