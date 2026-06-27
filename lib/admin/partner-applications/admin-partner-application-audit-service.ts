import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminPartnerApplicationAuditInput = {
  userId?: string | null;
  action: string;
  applicationId: string;
  displayMessage: string;
  partnerId?: string | null;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildApplicationAuditMetadata(
  applicationId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const meta: Record<string, unknown> = { applicationId, ...extra };
  if (extra?.partnerId) meta.partnerId = extra.partnerId;
  return meta;
}

export async function logAdminPartnerApplicationAudit(input: AdminPartnerApplicationAuditInput) {
  const metadata = buildApplicationAuditMetadata(input.applicationId, {
    ...input.metadata,
    ...(input.partnerId ? { partnerId: input.partnerId } : {}),
  });
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-partner-applications",
      message: input.displayMessage,
      entityType: "PartnerApplication",
      entityId: input.applicationId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export function buildStructuredApplicationActivityWhere(
  applicationId: string
): Prisma.ActivityLogWhereInput {
  return {
    module: "admin-partner-applications",
    OR: [
      { AND: [{ entityType: "PartnerApplication" }, { entityId: applicationId }] },
      { metadata: { path: ["applicationId"], equals: applicationId } },
    ],
  };
}
