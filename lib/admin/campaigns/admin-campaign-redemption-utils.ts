import "server-only";

import { db } from "@/lib/prisma";

export async function loadFinalizedRedemptionCountMap(
  campaignIds: string[]
): Promise<Map<string, number>> {
  if (!campaignIds.length) return new Map();

  const groups = await db.membershipDiscountRedemption.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: campaignIds },
      type: "CAMPAIGN",
      status: "FINALIZED",
    },
    _count: true,
  });

  return new Map(
    groups
      .filter((g): g is typeof g & { campaignId: string } => g.campaignId != null)
      .map((g) => [g.campaignId, g._count])
  );
}
