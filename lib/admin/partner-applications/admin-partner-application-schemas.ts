import { z } from "zod";
import { AdminPartnerApplicationServiceError } from "@/lib/admin/partner-applications/admin-partner-application-errors";

const forbiddenDecisionKeys = [
  "applicationId",
  "id",
  "status",
  "partnerId",
  "reviewedByUserId",
  "reviewedAt",
] as const;

const decisionBase = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
  })
  .strict();

export const adminPartnerApplicationApproveSchema = decisionBase
  .extend({
    referralCode: z.string().min(3).max(32).optional(),
    commissionRate: z.number().min(0).max(100).optional(),
    badgeType: z
      .enum(["NONE", "PARTNER", "VERIFIED", "INFLUENCER", "CELEBRITY", "VIP"])
      .optional(),
    badgeLabel: z.string().max(80).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const adminPartnerApplicationRejectSchema = decisionBase.strict();

export function assertNoForbiddenApplicationDecisionKeys(body: Record<string, unknown>) {
  for (const key of forbiddenDecisionKeys) {
    if (key in body) {
      throw new AdminPartnerApplicationServiceError(
        `"${key}" karar isteğinde kabul edilmez.`,
        400
      );
    }
  }
  if ("rejectionReason" in body && !("reason" in body)) {
    throw new AdminPartnerApplicationServiceError(
      'Red için "reason" alanını kullanın; generic status PATCH desteklenmez.',
      400
    );
  }
}
