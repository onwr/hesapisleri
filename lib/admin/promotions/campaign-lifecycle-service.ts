import "server-only";

import { db } from "@/lib/prisma";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";

const ENDING_WINDOW_DAYS = 3;

export async function runMembershipCampaignLifecycle(limit = 100) {
  const now = new Date();
  const endingThreshold = new Date(now.getTime() + ENDING_WINDOW_DAYS * 86_400_000);

  const scheduled = await db.membershipCampaign.findMany({
    where: { status: "SCHEDULED", startsAt: { lte: now } },
    take: limit,
    include: { scopes: { select: { companyId: true } } },
  });

  let activated = 0;
  for (const campaign of scheduled) {
    await db.$transaction(async (tx) => {
      const dedupeKey = `${campaign.id}:CAMPAIGN_STARTED:${campaign.startsAt.toISOString().slice(0, 10)}`;
      const existing = await tx.billingOutboxEvent.findFirst({
        where: {
          aggregateId: campaign.id,
          type: "CAMPAIGN_STARTED",
          payload: { path: ["dedupeKey"], equals: dedupeKey },
        },
      });

      await tx.membershipCampaign.update({
        where: { id: campaign.id },
        data: { status: "ACTIVE" },
      });

      if (!existing) {
        const companyId = campaign.scopes.find((s) => s.companyId)?.companyId;
        if (companyId) {
          await enqueueBillingOutboxEvent(
            {
              companyId,
              type: "CAMPAIGN_STARTED",
              aggregateType: "MembershipCampaign",
              aggregateId: campaign.id,
              payload: { campaignId: campaign.id, dedupeKey },
            },
            tx
          );
        }
      }

      await tx.activityLog.create({
        data: {
          module: "admin-promotions",
          action: "CAMPAIGN_ACTIVATED",
          message: JSON.stringify({ campaignId: campaign.id, source: "lifecycle-cron" }),
        },
      });
    });
    activated += 1;
  }

  const endingSoon = await db.membershipCampaign.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { gte: now, lte: endingThreshold },
    },
    take: limit,
    include: { scopes: { select: { companyId: true } } },
  });

  let endingEvents = 0;
  for (const campaign of endingSoon) {
    if (!campaign.endsAt) continue;
    if (!campaign.endsAt) continue;
    const dedupeKey = `${campaign.id}:CAMPAIGN_ENDING:${campaign.endsAt.toISOString().slice(0, 10)}`;
    const existing = await db.billingOutboxEvent.findFirst({
      where: {
        aggregateId: campaign.id,
        type: "CAMPAIGN_ENDING",
        payload: { path: ["dedupeKey"], equals: dedupeKey },
      },
    });
    if (existing) continue;
    const companyId = campaign.scopes.find((s) => s.companyId)?.companyId;
    if (companyId) {
      await enqueueBillingOutboxEvent({
        companyId,
        type: "CAMPAIGN_ENDING",
        aggregateType: "MembershipCampaign",
        aggregateId: campaign.id,
        payload: {
          campaignId: campaign.id,
          endsAt: campaign.endsAt.toISOString(),
          dedupeKey,
        },
      });
    }
    endingEvents += 1;
  }

  const expired = await db.membershipCampaign.findMany({
    where: {
      status: { in: ["ACTIVE", "SCHEDULED"] },
      endsAt: { lte: now },
    },
    take: limit,
    include: { scopes: { select: { companyId: true } } },
  });

  let expiredCount = 0;
  for (const campaign of expired) {
    const endsAt = campaign.endsAt;
    if (!endsAt) continue;
    await db.$transaction(async (tx) => {
      const dedupeKey = `${campaign.id}:CAMPAIGN_ENDED:${endsAt.toISOString().slice(0, 10)}`;
      const existing = await tx.billingOutboxEvent.findFirst({
        where: {
          aggregateId: campaign.id,
          type: "CAMPAIGN_ENDED",
          payload: { path: ["dedupeKey"], equals: dedupeKey },
        },
      });

      await tx.membershipCampaign.update({
        where: { id: campaign.id },
        data: { status: "EXPIRED" },
      });

      if (!existing) {
        const companyId = campaign.scopes.find((s) => s.companyId)?.companyId;
        if (companyId) {
          await enqueueBillingOutboxEvent(
            {
              companyId,
              type: "CAMPAIGN_ENDED",
              aggregateType: "MembershipCampaign",
              aggregateId: campaign.id,
              payload: { campaignId: campaign.id, dedupeKey },
            },
            tx
          );
        }
      }

      await tx.activityLog.create({
        data: {
          module: "admin-promotions",
          action: "CAMPAIGN_EXPIRED",
          message: JSON.stringify({ campaignId: campaign.id }),
        },
      });
    });
    expiredCount += 1;
  }

  return { activated, endingEvents, expired: expiredCount };
}
