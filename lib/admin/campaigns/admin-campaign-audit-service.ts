import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminCampaignAuditInput = {
  userId?: string | null;
  action: string;
  campaignId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildCampaignAuditMetadata(
  campaignId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { campaignId, ...extra };
}

export async function logAdminCampaignAudit(input: AdminCampaignAuditInput) {
  const metadata = buildCampaignAuditMetadata(input.campaignId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-campaigns",
      message: input.displayMessage,
      entityType: "MembershipCampaign",
      entityId: input.campaignId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
