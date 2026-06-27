import "server-only";

import { db } from "@/lib/prisma";

export async function loadFinalizedCouponRedemptionCountMap(
  couponIds: string[]
): Promise<Map<string, number>> {
  if (!couponIds.length) return new Map();

  const groups = await db.membershipDiscountRedemption.groupBy({
    by: ["couponId"],
    where: {
      couponId: { in: couponIds },
      type: "COUPON",
      status: "FINALIZED",
    },
    _count: true,
  });

  return new Map(
    groups
      .filter((g): g is typeof g & { couponId: string } => g.couponId != null)
      .map((g) => [g.couponId, g._count])
  );
}
