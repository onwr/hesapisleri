import type { Prisma } from "@prisma/client";
import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";

export type PayoutActivityScopeRow = {
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

export function metadataPayoutId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.payoutId === "string" ? meta.payoutId : null;
}

export function matchesStructuredPayoutScope(
  row: PayoutActivityScopeRow,
  payoutId: string
): boolean {
  if (row.module !== "admin-partner-payouts") return false;
  if (row.entityType === "PartnerPayout" && row.entityId === payoutId) return true;
  const meta = parseMetadata(row.metadata);
  return metadataPayoutId(meta) === payoutId;
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

export function redactPayoutActivityRow<T>(row: T): T {
  return redactValueRecursive(row) as T;
}
