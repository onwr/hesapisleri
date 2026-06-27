import type { Prisma } from "@prisma/client";

export type CouponActivityScopeRow = {
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

export function metadataCouponId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.couponId === "string" ? meta.couponId : null;
}

export function matchesStructuredCouponScope(row: CouponActivityScopeRow, couponId: string): boolean {
  if (row.module !== "admin-coupons" && row.module !== "admin-promotions") return false;
  if (row.entityType === "MembershipCoupon" && row.entityId === couponId) return true;
  const meta = parseMetadata(row.metadata);
  return metadataCouponId(meta) === couponId;
}

export function buildStructuredCouponActivityWhere(couponId: string): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { AND: [{ entityType: "MembershipCoupon" }, { entityId: couponId }] },
      { metadata: { path: ["couponId"], equals: couponId } },
    ],
  };
}
