import { db } from "@/lib/prisma";

export type AdminSubscriptionAuditAction =
  | "SUBSCRIPTION_TRIAL_EXTENDED"
  | "SUBSCRIPTION_PLAN_CHANGE_PREVIEWED"
  | "SUBSCRIPTION_PLAN_CHANGE_REQUESTED"
  | "SUBSCRIPTION_PLAN_CHANGED"
  | "SUBSCRIPTION_CANCELLATION_SCHEDULED"
  | "SUBSCRIPTION_CANCELLATION_REVOKED"
  | "SUBSCRIPTION_PROVIDER_SYNCED"
  | "ADMIN_SUBSCRIPTION_NOTE_CREATED"
  | "ADMIN_SUBSCRIPTION_NOTE_UPDATED"
  | "ADMIN_SUBSCRIPTION_NOTE_DELETED";

export async function logAdminSubscriptionAudit(input: {
  actorUserId: string;
  subscriptionId: string;
  companyId: string;
  action: AdminSubscriptionAuditAction;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  // Credential, token, callback body veya kart bilgisi yazılmaz.
  const safeMetadata = {
    subscriptionId: input.subscriptionId,
    companyId: input.companyId,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.before ? { before: input.before } : {}),
    ...(input.after ? { after: input.after } : {}),
    ...(input.metadata ?? {}),
  };

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      companyId: input.companyId,
      action: input.action,
      module: "admin-subscriptions",
      message: `${input.action}${input.reason ? `: ${input.reason}` : ""}`,
    },
  });

  void safeMetadata; // metadata structured logging placeholder
}
