import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminAddOnAuditInput = {
  userId?: string | null;
  action: string;
  addOnId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildAddOnAuditMetadata(
  addOnId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { addOnId, ...extra };
}

export async function logAdminAddOnAudit(input: AdminAddOnAuditInput) {
  const metadata = buildAddOnAuditMetadata(input.addOnId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-addons",
      message: input.displayMessage,
      entityType: "MembershipAddOn",
      entityId: input.addOnId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
