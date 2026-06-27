import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export type AdminCouponAuditInput = {
  userId?: string | null;
  action: string;
  couponId: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildCouponAuditMetadata(
  couponId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { couponId, ...extra };
}

export async function logAdminCouponAudit(input: AdminCouponAuditInput) {
  const metadata = buildCouponAuditMetadata(input.couponId, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-coupons",
      message: input.displayMessage,
      entityType: "MembershipCoupon",
      entityId: input.couponId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
