import "server-only";
import { db } from "@/lib/prisma";

export async function logAdminPaymentAudit(input: {
  actorUserId: string;
  paymentId: string;
  companyId: string;
  subscriptionId?: string | null;
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  // Credential, callback body, kart veya hash yazılmaz — subscription audit deseni.
  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      companyId: input.companyId,
      action: input.action,
      module: "admin-payments",
      message: `${input.action}${input.reason ? `: ${input.reason}` : ""} [payment:${input.paymentId}]`,
    },
  });
}
