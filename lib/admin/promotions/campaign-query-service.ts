import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { CampaignListFilters } from "@/lib/admin/promotions/promotion-types";
import {
  DEFAULT_CAMPAIGN_PAGE_SIZE,
} from "@/lib/admin/promotions/promotion-types";
import {
  detectCampaignIssues,
  loadPlanMapForScopes,
  type CampaignIssue,
} from "@/lib/admin/campaigns/admin-campaign-issue-service";
import {
  buildStructuredCampaignActivityWhere,
  matchesStructuredCampaignScope,
} from "@/lib/admin/campaigns/admin-campaign-activity-scope";
import { loadFinalizedRedemptionCountMap } from "@/lib/admin/campaigns/admin-campaign-redemption-utils";
import {
  redactValueRecursive,
  parseMetadata,
} from "@/lib/admin/plans/admin-plan-activity-scope";

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
  const soon = new Date(now.getTime() + 7 * 86_400_000);

  const [
    total,
    draft,
    active,
    scheduled,
    expired,
    archived,
    paused,
    endingSoon,
    startingSoon,
    noTargetLive,
    allLive,
  ] = await Promise.all([
    db.membershipCampaign.count(),
    db.membershipCampaign.count({ where: { status: "DRAFT" } }),
    db.membershipCampaign.count({ where: { status: "ACTIVE" } }),
    db.membershipCampaign.count({ where: { status: "SCHEDULED" } }),
    db.membershipCampaign.count({ where: { status: "EXPIRED" } }),
    db.membershipCampaign.count({ where: { status: "ARCHIVED" } }),
    db.membershipCampaign.count({ where: { status: "PAUSED" } }),
    db.membershipCampaign.count({
      where: { status: "ACTIVE", endsAt: { gte: now, lte: soon } },
    }),
    db.membershipCampaign.count({
      where: { status: { in: ["DRAFT", "SCHEDULED"] }, startsAt: { gte: now, lte: soon } },
    }),
    db.membershipCampaign.count({
      where: {
        status: { in: ["ACTIVE", "SCHEDULED"] },
        scopes: { none: {} },
      },
    }),
    db.membershipCampaign.findMany({
      where: { status: { in: ["ACTIVE", "SCHEDULED", "DRAFT"] } },
      include: {
        scopes: true,
        _count: { select: { redemptions: true } },
      },
    }),
  ]);

  const planMap = await loadPlanMapForScopes(allLive.flatMap((c) => c.scopes));
  const finalizedMap = await loadFinalizedRedemptionCountMap(allLive.map((c) => c.id));
  let usageLimitReached = 0;
  let priceResolutionIssues = 0;

  for (const row of allLive) {
    const finalized = finalizedMap.get(row.id) ?? 0;
    const issues = await detectCampaignIssues({
      id: row.id,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      overridePriceMinor: row.overridePriceMinor,
      currency: row.currency,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      maxRedemptions: row.maxRedemptions,
      autoApply: row.autoApply,
      stackable: row.stackable,
      priority: row.priority,
      scopes: row.scopes,
      redemptionCountAll: row._count.redemptions,
      redemptionCountFinalized: finalized,
      planById: planMap,
      now,
    });
    if (issues.some((i) => i.code === "USAGE_LIMIT_REACHED")) usageLimitReached += 1;
    if (
      issues.some((i) =>
        ["ACTIVE_WITHOUT_VALID_PRICE", "CURRENCY_MISMATCH", "FIXED_DISCOUNT_EXCEEDS_PRICE"].includes(
          i.code
        )
      )
    ) {
      priceResolutionIssues += 1;
    }
  }

  return {
    total,
    draft,
    active,
    scheduled,
    expired,
    archived,
    paused,
    endingSoon,
    startingSoon,
    noTarget: noTargetLive,
    usageLimitReached,
    priceResolutionIssues,
  };
}

async function enrichWithIssues(
  rows: Array<{
    id: string;
    status: import("@prisma/client").MembershipCampaignStatus;
    discountType: import("@prisma/client").DiscountType;
    discountValue: number;
    overridePriceMinor: number | null;
    currency: string;
    startsAt: Date;
    endsAt: Date | null;
    maxRedemptions: number | null;
    autoApply: boolean;
    stackable: boolean;
    priority: number;
    scopes: Array<{
      planId: string | null;
      billingInterval: import("@prisma/client").MembershipPeriod | null;
      companyId: string | null;
      partnerId: string | null;
    }>;
    _count: { redemptions: number };
  }>
) {
  const planMap = await loadPlanMapForScopes(rows.flatMap((r) => r.scopes));
  const finalizedMap = await loadFinalizedRedemptionCountMap(rows.map((r) => r.id));
  const now = new Date();
  const enriched: Array<{ issues: CampaignIssue[] }> = [];

  for (const row of rows) {
    const finalized = finalizedMap.get(row.id) ?? 0;
    const issues = await detectCampaignIssues({
      id: row.id,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      overridePriceMinor: row.overridePriceMinor,
      currency: row.currency,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      maxRedemptions: row.maxRedemptions,
      autoApply: row.autoApply,
      stackable: row.stackable,
      priority: row.priority,
      scopes: row.scopes,
      redemptionCountAll: row._count.redemptions,
      redemptionCountFinalized: finalized,
      planById: planMap,
      now,
    });
    enriched.push({ issues });
  }
  return enriched;
}

function collectCurrencies(
  currency: string,
  scopes: Array<{ plan?: { defaultCurrency?: string; currency?: string } | null }>
) {
  const set = new Set<string>([currency]);
  for (const s of scopes) {
    const pc = s.plan?.defaultCurrency || s.plan?.currency;
    if (pc) set.add(pc);
  }
  return [...set];
}

export async function listCampaigns(filters: CampaignListFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_CAMPAIGN_PAGE_SIZE;
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
        scopes: {
          include: {
            plan: { select: { id: true, name: true, defaultCurrency: true, currency: true } },
          },
        },
        _count: { select: { redemptions: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const issueEnrichment = await enrichWithIssues(rows);

  const finalizedMap = await loadFinalizedRedemptionCountMap(rows.map((r) => r.id));

  let mapped = rows.map((row, idx) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    discountType: row.discountType,
    discountValue: row.discountValue,
    currency: row.currency,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    priority: row.priority,
    autoApply: row.autoApply,
    stackable: row.stackable,
    renewalAllowed: row.renewalAllowed,
    maxRedemptions: row.maxRedemptions,
    usageCount: finalizedMap.get(row.id) ?? 0,
    usageCountAll: row._count.redemptions,
    currencies: collectCurrencies(row.currency, row.scopes),
    issues: issueEnrichment[idx]!.issues,
    scopes: row.scopes,
  }));

  if (filters.issue?.trim()) {
    const code = filters.issue.trim();
    mapped = mapped.filter((item) => item.issues.some((i) => i.code === code));
  }

  return {
    items: mapped,
    pagination: {
      page,
      pageSize,
      total: filters.issue ? mapped.length : total,
      totalPages: Math.max(1, Math.ceil((filters.issue ? mapped.length : total) / pageSize)),
    },
  };
}

export async function getCampaignDetail(id: string) {
  const campaign = await db.membershipCampaign.findUnique({
    where: { id },
    include: {
      scopes: {
        include: {
          plan: { select: { id: true, name: true, planStatus: true } },
          company: { select: { id: true, name: true } },
          partner: { select: { id: true, fullName: true, referralCode: true } },
        },
      },
    },
  });
  if (!campaign) return null;

  const stats = await db.membershipDiscountRedemption.aggregate({
    where: { campaignId: id, type: "CAMPAIGN", status: "FINALIZED" },
    _sum: { amountMinor: true },
    _count: true,
  });

  const planMap = await loadPlanMapForScopes(campaign.scopes);
  const issues = await detectCampaignIssues({
    id: campaign.id,
    status: campaign.status,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue,
    overridePriceMinor: campaign.overridePriceMinor,
    currency: campaign.currency,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    maxRedemptions: campaign.maxRedemptions,
    autoApply: campaign.autoApply,
    stackable: campaign.stackable,
    priority: campaign.priority,
    scopes: campaign.scopes,
    redemptionCountFinalized: stats._count,
    planById: planMap,
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
    issues,
  };
}

export async function listCampaignUsage(
  campaignId: string,
  query: { page?: number; pageSize?: number; status?: string; companyId?: string }
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = [25, 50, 100].includes(query.pageSize ?? 25)
    ? (query.pageSize as number)
    : 25;

  const where: Prisma.MembershipDiscountRedemptionWhereInput = {
    campaignId,
    type: "CAMPAIGN",
  };
  if (query.status) where.status = query.status as Prisma.EnumDiscountRedemptionStatusFilter;
  if (query.companyId) where.companyId = query.companyId;

  const [total, rows] = await Promise.all([
    db.membershipDiscountRedemption.count({ where }),
    db.membershipDiscountRedemption.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true } },
        payment: {
          select: {
            id: true,
            status: true,
            amountMinor: true,
            currency: true,
            planId: true,
            plan: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      companyId: row.companyId,
      companyName: row.company.name,
      subscriptionId: row.subscriptionId,
      paymentId: row.paymentId,
      paymentStatus: row.payment?.status ?? null,
      planId: row.payment?.planId ?? null,
      planName: row.payment?.plan?.name ?? null,
      billingInterval: row.billingInterval,
      amountMinor: row.amountMinor,
      currency: row.payment?.currency ?? null,
      status: row.status,
      source: row.type,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    totals: {
      successfulUsage: await db.membershipDiscountRedemption.count({
        where: { campaignId, type: "CAMPAIGN", status: "FINALIZED" },
      }),
    },
  };
}

export async function listCampaignHistory(campaignId: string, page = 1, pageSize = 25) {
  const structuredWhere = buildStructuredCampaignActivityWhere(campaignId);
  const legacyRows = await db.activityLog.findMany({
    where: {
      module: "admin-promotions",
      message: { contains: campaignId },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const structuredRows = await db.activityLog.findMany({
    where: structuredWhere,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const seen = new Set<string>();
  const merged = [...structuredRows, ...legacyRows]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      if (
        row.module === "admin-promotions" &&
        row.entityType !== "MembershipCampaign" &&
        !matchesStructuredCampaignScope(row, campaignId)
      ) {
        return row.message?.includes(campaignId) ?? false;
      }
      return matchesStructuredCampaignScope(row, campaignId) || row.entityId === campaignId;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const start = (page - 1) * pageSize;
  const slice = merged.slice(start, start + pageSize);

  return {
    items: slice.map((row) => ({
      id: row.id,
      action: row.action,
      message: row.message ?? "",
      createdAt: row.createdAt.toISOString(),
      actorName: row.user?.name ?? row.user?.email ?? "Sistem",
      category: categorizeCampaignAction(row.action),
    })),
    pagination: {
      page,
      pageSize,
      total: merged.length,
      totalPages: Math.max(1, Math.ceil(merged.length / pageSize)),
    },
  };
}

function categorizeCampaignAction(action: string) {
  if (action.includes("CREATED")) return "created";
  if (action.includes("UPDATED") && !action.includes("TARGETING")) return "updated";
  if (action.includes("ACTIVATED") || action.includes("PUBLISHED")) return "activated";
  if (action.includes("PAUSED")) return "paused";
  if (action.includes("ARCHIVED")) return "archived";
  if (action.includes("TARGETING")) return "targeting";
  if (action.includes("PRICING") || action.includes("DISCOUNT")) return "pricing";
  if (action.includes("LIMIT")) return "limit";
  return "other";
}

export async function listCampaignActivity(campaignId: string, page = 1, pageSize = 25) {
  const where = buildStructuredCampaignActivityWhere(campaignId);
  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      module: row.module,
      message: row.message,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: redactValueRecursive(parseMetadata(row.metadata)),
      createdAt: row.createdAt.toISOString(),
      actor: row.user
        ? { id: row.user.id, name: row.user.name, email: row.user.email }
        : null,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
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

/** @deprecated use listCampaignHistory — legacy alias */
export async function listCampaignActivityHistory(campaignId: string) {
  const result = await listCampaignHistory(campaignId, 1, 50);
  return result.items;
}
