import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { CouponListFilters } from "@/lib/admin/promotions/promotion-types";
import { DEFAULT_COUPON_PAGE_SIZE } from "@/lib/admin/promotions/promotion-types";
import {
  detectCouponIssues,
  loadPlanMapForCouponPlans,
  type CouponIssue,
} from "@/lib/admin/coupons/admin-coupon-issue-service";
import { loadFinalizedCouponRedemptionCountMap } from "@/lib/admin/coupons/admin-coupon-redemption-utils";
import {
  buildStructuredCouponActivityWhere,
  matchesStructuredCouponScope,
} from "@/lib/admin/coupons/admin-coupon-activity-scope";
import {
  redactValueRecursive,
  parseMetadata,
} from "@/lib/admin/plans/admin-plan-activity-scope";

function buildCouponWhere(filters: CouponListFilters): Prisma.MembershipCouponWhereInput {
  const where: Prisma.MembershipCouponWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.discountType) where.discountType = filters.discountType;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filters.planId) where.planScopes = { some: { planId: filters.planId } };
  if (filters.interval) where.allowedIntervals = { has: filters.interval };
  if (filters.firstPaymentOnly === "true") where.firstPaymentOnly = true;
  if (filters.firstPaymentOnly === "false") where.firstPaymentOnly = false;
  if (filters.renewalAllowed === "true") where.renewalAllowed = true;
  if (filters.renewalAllowed === "false") where.renewalAllowed = false;
  if (filters.expiresFrom || filters.expiresTo) {
    where.expiresAt = {};
    if (filters.expiresFrom) where.expiresAt.gte = new Date(filters.expiresFrom);
    if (filters.expiresTo) where.expiresAt.lte = new Date(filters.expiresTo);
  }
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {};
    if (filters.createdFrom) where.createdAt.gte = new Date(filters.createdFrom);
    if (filters.createdTo) where.createdAt.lte = new Date(filters.createdTo);
  }
  return where;
}

export async function getCouponSummary() {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 86_400_000);

  const [total, draft, active, expired, archived, paused, endingSoon, neverUsed, allForIssues] =
    await Promise.all([
      db.membershipCoupon.count(),
      db.membershipCoupon.count({ where: { status: "DRAFT" } }),
      db.membershipCoupon.count({ where: { status: "ACTIVE" } }),
      db.membershipCoupon.count({ where: { status: "EXPIRED" } }),
      db.membershipCoupon.count({ where: { status: "ARCHIVED" } }),
      db.membershipCoupon.count({ where: { status: "PAUSED" } }),
      db.membershipCoupon.count({
        where: { status: "ACTIVE", expiresAt: { gte: now, lte: soon } },
      }),
      db.membershipCoupon.count({
        where: { discountUses: { none: { status: "FINALIZED" } } },
      }),
      db.membershipCoupon.findMany({
        where: { status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
        include: {
          planScopes: true,
          _count: { select: { discountUses: true } },
        },
      }),
    ]);

  const finalizedMap = await loadFinalizedCouponRedemptionCountMap(allForIssues.map((c) => c.id));
  const planMap = await loadPlanMapForCouponPlans(
    allForIssues.flatMap((c) => c.planScopes.map((s) => s.planId))
  );

  let usageLimitReached = 0;
  let targetingIssues = 0;

  for (const row of allForIssues) {
    const finalized = finalizedMap.get(row.id) ?? 0;
    const issues = await detectCouponIssues({
      id: row.id,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      currency: row.currency,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      maxUsage: row.maxUsage,
      maxUsagePerCompany: row.maxUsagePerCompany,
      stackable: row.stackable,
      allowedIntervals: row.allowedIntervals,
      planIds: row.planScopes.map((s) => s.planId),
      redemptionCountAll: row._count.discountUses,
      redemptionCountFinalized: finalized,
      planById: planMap,
      now,
    });
    if (issues.some((i) => i.code === "USAGE_LIMIT_REACHED")) usageLimitReached += 1;
    if (
      issues.some((i) =>
        [
          "ACTIVE_WITHOUT_TARGET",
          "CURRENCY_MISMATCH",
          "ARCHIVED_PLAN_TARGET",
          "FIXED_DISCOUNT_EXCEEDS_PRICE",
        ].includes(i.code)
      )
    ) {
      targetingIssues += 1;
    }
  }

  return {
    total,
    draft,
    active,
    expired,
    archived,
    paused,
    endingSoon,
    neverUsed,
    usageLimitReached,
    targetingIssues,
  };
}

async function enrichWithIssues(
  rows: Array<{
    id: string;
    status: import("@prisma/client").MembershipCouponStatus;
    discountType: import("@prisma/client").DiscountType;
    discountValue: number;
    currency: string;
    startsAt: Date;
    expiresAt: Date | null;
    maxUsage: number | null;
    maxUsagePerCompany: number;
    stackable: boolean;
    allowedIntervals: import("@prisma/client").MembershipPeriod[];
    planScopes: Array<{ planId: string }>;
    _count: { discountUses: number };
  }>,
  finalizedMap: Map<string, number>
) {
  const planMap = await loadPlanMapForCouponPlans(
    rows.flatMap((r) => r.planScopes.map((s) => s.planId))
  );
  const now = new Date();
  const enriched: CouponIssue[][] = [];

  for (const row of rows) {
    const issues = await detectCouponIssues({
      id: row.id,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      currency: row.currency,
      startsAt: row.startsAt,
      expiresAt: row.expiresAt,
      maxUsage: row.maxUsage,
      maxUsagePerCompany: row.maxUsagePerCompany,
      stackable: row.stackable,
      allowedIntervals: row.allowedIntervals,
      planIds: row.planScopes.map((s) => s.planId),
      redemptionCountAll: row._count.discountUses,
      redemptionCountFinalized: finalizedMap.get(row.id) ?? 0,
      planById: planMap,
      now,
    });
    enriched.push(issues);
  }
  return enriched;
}

export async function listCoupons(filters: CouponListFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_COUPON_PAGE_SIZE;
  const where = buildCouponWhere(filters);
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.MembershipCouponOrderByWithRelationInput =
    filters.sort === "startsAt"
      ? { startsAt: order }
      : filters.sort === "created"
        ? { createdAt: order }
        : filters.sort === "expiresAt"
          ? { expiresAt: order }
          : { code: order };

  const [total, rows] = await Promise.all([
    db.membershipCoupon.count({ where }),
    db.membershipCoupon.findMany({
      where,
      include: {
        planScopes: {
          include: { plan: { select: { id: true, name: true } } },
        },
        _count: { select: { discountUses: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const finalizedMap = await loadFinalizedCouponRedemptionCountMap(rows.map((r) => r.id));
  const issueEnrichment = await enrichWithIssues(rows, finalizedMap);

  let mapped = rows.map((row, idx) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    discountType: row.discountType,
    discountValue: row.discountValue,
    currency: row.currency,
    startsAt: row.startsAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    maxUsage: row.maxUsage,
    maxUsagePerCompany: row.maxUsagePerCompany,
    usageCount: finalizedMap.get(row.id) ?? 0,
    usageCountAll: row._count.discountUses,
    allowedIntervals: row.allowedIntervals,
    planScopes: row.planScopes,
    issues: issueEnrichment[idx]!,
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

export async function getCouponDetail(id: string) {
  const coupon = await db.membershipCoupon.findUnique({
    where: { id },
    include: {
      planScopes: { include: { plan: { select: { id: true, name: true, planStatus: true } } } },
    },
  });
  if (!coupon) return null;

  const stats = await db.membershipDiscountRedemption.aggregate({
    where: { couponId: id, type: "COUPON", status: "FINALIZED" },
    _sum: { amountMinor: true },
    _count: true,
  });

  const planMap = await loadPlanMapForCouponPlans(coupon.planScopes.map((s) => s.planId));
  const issues = await detectCouponIssues({
    id: coupon.id,
    status: coupon.status,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    currency: coupon.currency,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    maxUsage: coupon.maxUsage,
    maxUsagePerCompany: coupon.maxUsagePerCompany,
    stackable: coupon.stackable,
    allowedIntervals: coupon.allowedIntervals,
    planIds: coupon.planScopes.map((s) => s.planId),
    redemptionCountFinalized: stats._count,
    planById: planMap,
  });

  return {
    coupon: {
      ...coupon,
      startsAt: coupon.startsAt.toISOString(),
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      archivedAt: coupon.archivedAt?.toISOString() ?? null,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    },
    stats: {
      usageCount: stats._count,
      totalDiscountMinor: stats._sum.amountMinor ?? 0,
    },
    issues,
  };
}

export async function listCouponUsage(
  couponId: string,
  query: { page?: number; pageSize?: number; status?: string; companyId?: string }
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = [25, 50, 100].includes(query.pageSize ?? 25)
    ? (query.pageSize as number)
    : 25;

  const where: Prisma.MembershipDiscountRedemptionWhereInput = {
    couponId,
    type: "COUPON",
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
      idempotencyKey: row.idempotencyKey,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    totals: {
      successfulUsage: await db.membershipDiscountRedemption.count({
        where: { couponId, type: "COUPON", status: "FINALIZED" },
      }),
    },
  };
}

export async function listCouponHistory(couponId: string, page = 1, pageSize = 25) {
  const structuredWhere = buildStructuredCouponActivityWhere(couponId);
  const legacyRows = await db.activityLog.findMany({
    where: { module: "admin-promotions", message: { contains: couponId } },
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
      return matchesStructuredCouponScope(row, couponId) || row.entityId === couponId;
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
    })),
    pagination: {
      page,
      pageSize,
      total: merged.length,
      totalPages: Math.max(1, Math.ceil(merged.length / pageSize)),
    },
  };
}

export async function listCouponActivity(couponId: string, page = 1, pageSize = 25) {
  const where = buildStructuredCouponActivityWhere(couponId);
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

/** @deprecated use listCouponHistory */
export async function listCouponActivityHistory(couponId: string) {
  const result = await listCouponHistory(couponId, 1, 50);
  return result.items;
}

export async function listCouponRedemptions(couponId: string, page = 1) {
  return listCouponUsage(couponId, { page, pageSize: 25 });
}
