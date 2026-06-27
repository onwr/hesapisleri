import { db } from "@/lib/prisma";

export async function logAdminCompanyAudit(input: {
  actorUserId: string;
  companyId: string;
  action: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    action: input.action,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
    timestamp: new Date().toISOString(),
    adminUserId: input.actorUserId,
    companyId: input.companyId,
  };

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      companyId: input.companyId,
      action: input.action,
      module: "admin-companies",
      message: JSON.stringify(payload),
    },
  });
}
