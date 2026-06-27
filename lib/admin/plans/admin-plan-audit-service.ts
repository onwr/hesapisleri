import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminPlanEntityType =
  | "MembershipPlan"
  | "MembershipPlanPrice"
  | "PlanFeature"
  | "PlanEntitlementVersion"
  | "AdminPlanNote";

export type AdminPlanAuditInput = {
  userId?: string | null;
  action: string;
  planId: string;
  entityType: AdminPlanEntityType;
  entityId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildPlanAuditMetadata(
  planId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { planId, ...extra };
}

export async function logAdminPlanAudit(input: AdminPlanAuditInput) {
  const metadata = buildPlanAuditMetadata(input.planId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-plans",
      message: input.displayMessage,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: metadata as Prisma.InputJsonValue,
      ip: input.ip ?? null,
    },
  });
}
