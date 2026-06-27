import type { Prisma } from "@prisma/client";

export type CampaignActivityScopeRow = {
  id: string;
  action: string;
  module: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

export function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

export function metadataCampaignId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.campaignId === "string" ? meta.campaignId : null;
}

export function matchesStructuredCampaignScope(row: CampaignActivityScopeRow, campaignId: string): boolean {
  if (row.module !== "admin-campaigns" && row.module !== "admin-promotions") return false;
  if (row.entityType === "MembershipCampaign" && row.entityId === campaignId) return true;
  const meta = parseMetadata(row.metadata);
  return metadataCampaignId(meta) === campaignId;
}

export function buildStructuredCampaignActivityWhere(campaignId: string): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { AND: [{ entityType: "MembershipCampaign" }, { entityId: campaignId }] },
      { metadata: { path: ["campaignId"], equals: campaignId } },
    ],
  };
}
