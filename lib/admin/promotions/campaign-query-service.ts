import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { CampaignListFilters } from "@/lib/admin/promotions/promotion-types";
import { PROMOTION_PAGE_SIZE } from "@/lib/admin/promotions/promotion-types";

function buildCampaignWhere(filters: CampaignListFilters): Prisma.MembershipCampaignWhereInput {
  const where: Prisma.MembershipCampaignWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.discountType) where.discountType = filters.discountType;
  if (filters.autoApply === "true") where.autoApply = true;
  if (filters.autoApply === "false") where.autoApply = false;
  if (filters.renewalAllowed === "true") where.renewalAllowed = true;
  if (filters.renewalAllowed === "false") where.renewalAllowed = false;
  if (filters.stackable === "true") where.stackable = true;
  if (filters.stackable === "false") where.stackable = false;
  if (filters.firstPaymentOnly === "true") where.firstPaymentOnly = true;
  if (filters.firstPaymentOnly === "false") where.firstPaymentOnly = false;
  if (filters.companyScoped === "true") {
    where.scopes = { some: { companyId: { not: null } } };
  }
  if (filters.partnerScoped === "true") {
    where.scopes = { some: { partnerId: { not: null } } };
  }
  if (filters.startsFrom || filters.startsTo) {
    where.startsAt = {};
    if (filters.startsFrom) where.startsAt.gte = new Date(filters.startsFrom);
    if (filters.startsTo) where.startsAt.lte = new Date(filters.startsTo);
  }
  if (filters.endsFrom || filters.endsTo) {
    where.endsAt = {};
    if (filters.endsFrom) where.endsAt.gte = new Date(filters.endsFrom);
    if (filters.endsTo) where.endsAt.lte = new Date(filters.endsTo);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.planId || filters.interval) {
    where.scopes = {
      some: {
        ...(filters.planId ? { planId: filters.planId } : {}),
        ...(filters.interval ? { billingInterval: filters.interval } : {}),
      },
    };
  }
  return where;
}

export async function getCampaignSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const soonEnd = new Date(now.getTime() + 7 * 86_400_000);

  const [total, active, scheduled, monthlyUsage, totalDiscount, endingSoon] =
    await Promise.all([
      db.membershipCampaign.count(),
      db.membershipCampaign.count({ where: { status: "ACTIVE" } }),
      db.membershipCampaign.count({ where: { status: "SCHEDULED" } }),
      db.membershipDiscountRedemption.count({
        where: {
          type: "CAMPAIGN",
          status: "FINALIZED",
          finalizedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      db.membershipDiscountRedemption.aggregate({
        where: { type: "CAMPAIGN", status: "FINALIZED" },
        _sum: { amountMinor: true },
      }),
      db.membershipCampaign.count({
        where: {
          status: "ACTIVE",
          endsAt: { gte: now, lte: soonEnd },
        },
      }),
    ]);

  return {
    total,
    active,
    scheduled,
    monthlyUsage,
    totalDiscountMinor: totalDiscount._sum.amountMinor ?? 0,
    endingSoon,
  };
}

export async function listCampaigns(filters: CampaignListFilters) {
  const page = filters.page ?? 1;
  const where = buildCampaignWhere(filters);
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.MembershipCampaignOrderByWithRelationInput =
    filters.sort === "priority"
      ? { priority: order }
      : filters.sort === "startsAt"
        ? { startsAt: order }
        : filters.sort === "created"
          ? { createdAt: order }
          : { name: order };

  const [total, rows] = await Promise.all([
    db.membershipCampaign.count({ where }),
    db.membershipCampaign.findMany({
      where,
      include: {
        scopes: { include: { plan: { select: { id: true, name: true } } } },
        _count: { select: { redemptions: true } },
      },
      orderBy,
      skip: (page - 1) * PROMOTION_PAGE_SIZE,
      take: PROMOTION_PAGE_SIZE,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      priority: row.priority,
      autoApply: row.autoApply,
      stackable: row.stackable,
      renewalAllowed: row.renewalAllowed,
      usageCount: row._count.redemptions,
      scopes: row.scopes,
    })),
    pagination: {
      page,
      pageSize: PROMOTION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PROMOTION_PAGE_SIZE)),
    },
  };
}

export async function getCampaignDetail(id: string) {
  const campaign = await db.membershipCampaign.findUnique({
    where: { id },
    include: {
      scopes: {
        include: {
          plan: { select: { id: true, name: true } },
          company: { select: { id: true, name: true } },
          partner: { select: { id: true, fullName: true, referralCode: true } },
        },
      },
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          company: { select: { id: true, name: true } },
          payment: { select: { id: true, status: true, amountMinor: true } },
        },
      },
    },
  });
  if (!campaign) return null;

  const stats = await db.membershipDiscountRedemption.aggregate({
    where: { campaignId: id, status: "FINALIZED" },
    _sum: { amountMinor: true },
    _count: true,
  });

  return {
    campaign: {
      ...campaign,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt?.toISOString() ?? null,
      publishedAt: campaign.publishedAt?.toISOString() ?? null,
      pausedAt: campaign.pausedAt?.toISOString() ?? null,
      archivedAt: campaign.archivedAt?.toISOString() ?? null,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    },
    stats: {
      usageCount: stats._count,
      totalDiscountMinor: stats._sum.amountMinor ?? 0,
    },
  };
}

export async function listCampaignAffectedSubscriptions(campaignId: string) {
  const campaign = await db.membershipCampaign.findUnique({
    where: { id: campaignId },
    include: { scopes: true },
  });
  if (!campaign) return [];

  const planIds = [
    ...new Set(campaign.scopes.map((s) => s.planId).filter(Boolean)),
  ] as string[];
  const intervals = [
    ...new Set(
      campaign.scopes
        .map((s) => s.billingInterval)
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
    ),
  ];
  const companyIds = [
    ...new Set(campaign.scopes.map((s) => s.companyId).filter(Boolean)),
  ] as string[];

  const where: Prisma.CompanySubscriptionWhereInput = {
    status: {
      in: ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END"],
    },
  };
  if (planIds.length) where.planId = { in: planIds };
  if (intervals.length) where.billingInterval = { in: intervals };
  if (companyIds.length) where.companyId = { in: companyIds };

  const rows = await db.companySubscription.findMany({
    where,
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    planName: row.plan?.name ?? "—",
    billingInterval: row.billingInterval,
    status: row.status,
    renewalEligible: campaign.renewalAllowed,
    isNewCustomer: false,
  }));
}

export async function listCampaignActivityHistory(campaignId: string) {
  const rows = await db.activityLog.findMany({
    where: {
      module: "admin-promotions",
      OR: [
        { message: { contains: campaignId } },
        { message: { contains: `"campaignId":"${campaignId}"` } },
        { message: { contains: `"campaignId": "${campaignId}"` } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    message: row.message ?? "",
    createdAt: row.createdAt.toISOString(),
    actorName: row.user?.name ?? row.user?.email ?? "Sistem",
  }));
}
