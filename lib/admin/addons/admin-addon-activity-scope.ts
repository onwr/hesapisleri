import type { Prisma } from "@prisma/client";

export type AddOnActivityScopeRow = {
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

export function metadataAddOnId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.addOnId === "string" ? meta.addOnId : null;
}

export function matchesStructuredAddOnScope(
  row: AddOnActivityScopeRow,
  addOnId: string
): boolean {
  if (row.module !== "admin-addons") return false;
  if (row.entityType === "MembershipAddOn" && row.entityId === addOnId) return true;
  const meta = parseMetadata(row.metadata);
  return metadataAddOnId(meta) === addOnId;
}

export function buildStructuredAddOnActivityWhere(addOnId: string): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { AND: [{ entityType: "MembershipAddOn" }, { entityId: addOnId }] },
      { metadata: { path: ["addOnId"], equals: addOnId } },
    ],
  };
}
