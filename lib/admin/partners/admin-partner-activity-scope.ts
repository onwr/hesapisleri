import type { Prisma } from "@prisma/client";
import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";

export type PartnerActivityScopeRow = {
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

export function metadataPartnerId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.partnerId === "string" ? meta.partnerId : null;
}

export function matchesStructuredPartnerScope(
  row: PartnerActivityScopeRow,
  partnerId: string
): boolean {
  if (row.module !== "admin-partners") return false;
  if (row.entityType === "PartnerProfile" && row.entityId === partnerId) return true;
  const meta = parseMetadata(row.metadata);
  return metadataPartnerId(meta) === partnerId;
}

export function buildStructuredPartnerActivityWhere(
  partnerId: string
): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { AND: [{ entityType: "PartnerProfile" }, { entityId: partnerId }] },
      { metadata: { path: ["partnerId"], equals: partnerId } },
    ],
  };
}

export function redactPartnerActivityRow<T>(row: T): T {
  return redactValueRecursive(row) as T;
}
