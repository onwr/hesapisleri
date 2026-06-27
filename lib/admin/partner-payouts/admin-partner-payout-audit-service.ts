import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminPartnerPayoutAuditInput = {
  userId?: string | null;
  action: string;
  payoutId: string;
  partnerId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildPayoutAuditMetadata(
  payoutId: string,
  partnerId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { payoutId, partnerId, ...extra };
}

export async function logAdminPartnerPayoutAudit(input: AdminPartnerPayoutAuditInput) {
  const metadata = buildPayoutAuditMetadata(input.payoutId, input.partnerId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-partner-payouts",
      message: input.displayMessage,
      entityType: "PartnerPayout",
      entityId: input.payoutId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export function buildStructuredPayoutActivityWhere(
  payoutId: string
): Prisma.ActivityLogWhereInput {
  return {
    module: "admin-partner-payouts",
    OR: [
      { AND: [{ entityType: "PartnerPayout" }, { entityId: payoutId }] },
      { metadata: { path: ["payoutId"], equals: payoutId } },
    ],
  };
}
