import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminPartnerAuditInput = {
  userId?: string | null;
  action: string;
  partnerId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildPartnerAuditMetadata(
  partnerId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { partnerId, ...extra };
}

export async function logAdminPartnerAudit(input: AdminPartnerAuditInput) {
  const metadata = buildPartnerAuditMetadata(input.partnerId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-partners",
      message: input.displayMessage,
      entityType: input.entityType ?? "PartnerProfile",
      entityId: input.entityId ?? input.partnerId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
