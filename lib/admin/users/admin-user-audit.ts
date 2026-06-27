import { db } from "@/lib/prisma";

export type AdminUserAuditAction =
  | "USER_SUSPENDED"
  | "USER_REACTIVATED"
  | "USER_PASSWORD_RESET_SENT"
  | "USER_VERIFICATION_RESENT"
  | "USER_SESSIONS_REVOKED"
  | "USER_ACCOUNT_UNLOCKED"
  | "USER_COMPANY_ROLE_UPDATED"
  | "USER_COMPANY_MEMBERSHIP_DEACTIVATED"
  | "USER_COMPANY_MEMBERSHIP_REACTIVATED"
  | "USER_INVITATION_RESENT"
  | "ADMIN_USER_NOTE_CREATED"
  | "ADMIN_USER_NOTE_UPDATED"
  | "ADMIN_USER_NOTE_DELETED";

export async function logAdminUserAudit(input: {
  actorUserId: string;
  targetUserId: string;
  action: AdminUserAuditAction;
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
    targetUserId: input.targetUserId,
  };

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      companyId: null,
      action: input.action,
      module: "admin-users",
      message: JSON.stringify(payload),
    },
  });
}
