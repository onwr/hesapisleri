import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { CouponListFilters } from "@/lib/admin/promotions/promotion-types";
import { PROMOTION_PAGE_SIZE } from "@/lib/admin/promotions/promotion-types";

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
  if (filters.planId) {
    where.planScopes = { some: { planId: filters.planId } };
  }
  if (filters.interval) {
    where.allowedIntervals = { has: filters.interval };
  }
  if (filters.firstPaymentOnly === "true") where.firstPaymentOnly = true;
  if (filters.firstPaymentOnly === "false") where.firstPaymentOnly = false;
  if (filters.renewalAllowed === "true") where.renewalAllowed = true;
  if (filters.renewalAllowed === "false") where.renewalAllowed = false;
  if (filters.usageStatus === "limit_reached") {
    where.maxUsage = { not: null };
  }
  if (filters.usageStatus === "expired") {
    where.expiresAt = { lt: new Date() };
  }
  if (filters.expiresFrom || filters.expiresTo) {
    where.expiresAt = where.expiresAt ?? {};
    if (filters.expiresFrom) (where.expiresAt as { gte?: Date }).gte = new Date(filters.expiresFrom);
    if (filters.expiresTo) (where.expiresAt as { lte?: Date }).lte = new Date(filters.expiresTo);
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const soonEnd = new Date(now.getTime() + 7 * 86_400_000);

  const [total, active, monthlyUsage, limitReached, endingSoon, totalDiscount] =
    await Promise.all([
      db.membershipCoupon.count(),
      db.membershipCoupon.count({ where: { status: "ACTIVE" } }),
      db.membershipDiscountRedemption.count({
        where: {
          type: "COUPON",
          status: "FINALIZED",
          finalizedAt: { gte: monthStart, lte: monthEnd },
        },
      }),
      db.membershipCoupon.count({
        where: {
          status: "ACTIVE",
          maxUsage: { not: null },
        },
      }),
      db.membershipCoupon.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gte: now, lte: soonEnd },
        },
      }),
      db.membershipDiscountRedemption.aggregate({
        where: { type: "COUPON", status: "FINALIZED" },
        _sum: { amountMinor: true },
      }),
    ]);

  return {
    total,
    active,
    monthlyUsage,
    limitReached,
    endingSoon,
    totalDiscountMinor: totalDiscount._sum.amountMinor ?? 0,
  };
}

export async function listCoupons(filters: CouponListFilters) {
  const page = filters.page ?? 1;
  const where = buildCouponWhere(filters);
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.MembershipCouponOrderByWithRelationInput =
    filters.sort === "startsAt"
      ? { startsAt: order }
      : filters.sort === "created"
        ? { createdAt: order }
        : { code: order };

  const [total, rows] = await Promise.all([
    db.membershipCoupon.count({ where }),
    db.membershipCoupon.findMany({
      where,
      include: {
        planScopes: { include: { plan: { select: { id: true, name: true } } } },
        _count: { select: { discountUses: true } },
      },
      orderBy,
      skip: (page - 1) * PROMOTION_PAGE_SIZE,
      take: PROMOTION_PAGE_SIZE,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      discountType: row.discountType,
      discountValue: row.discountValue,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      maxUsage: row.maxUsage,
      maxUsagePerCompany: row.maxUsagePerCompany,
      usageCount: row._count.discountUses,
      allowedIntervals: row.allowedIntervals,
      planScopes: row.planScopes,
    })),
    pagination: {
      page,
      pageSize: PROMOTION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PROMOTION_PAGE_SIZE)),
    },
  };
}

export async function getCouponDetail(id: string) {
  const coupon = await db.membershipCoupon.findUnique({
    where: { id },
    include: {
      planScopes: { include: { plan: { select: { id: true, name: true } } } },
      discountUses: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          company: { select: { id: true, name: true } },
          payment: { select: { id: true, status: true, amountMinor: true } },
        },
      },
    },
  });
  if (!coupon) return null;

  const stats = await db.membershipDiscountRedemption.aggregate({
    where: { couponId: id, status: "FINALIZED" },
    _sum: { amountMinor: true },
    _count: true,
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
  };
}

export async function listCouponActivityHistory(couponId: string) {
  const coupon = await db.membershipCoupon.findUnique({
    where: { id: couponId },
    select: { code: true },
  });
  if (!coupon) return [];

  const rows = await db.activityLog.findMany({
    where: {
      module: "admin-promotions",
      OR: [
        { message: { contains: couponId } },
        { message: { contains: coupon.code } },
        { message: { contains: `"couponId":"${couponId}"` } },
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

const REDEMPTION_PAGE_SIZE = 25;

export async function listCouponRedemptions(couponId: string, page = 1) {
  const skip = (page - 1) * REDEMPTION_PAGE_SIZE;

  const [items, total] = await Promise.all([
    db.membershipDiscountRedemption.findMany({
      where: { couponId },
      orderBy: { createdAt: "desc" },
      skip,
      take: REDEMPTION_PAGE_SIZE,
      include: {
        company: { select: { id: true, name: true } },
        payment: { select: { id: true, status: true, amountMinor: true } },
      },
    }),
    db.membershipDiscountRedemption.count({ where: { couponId } }),
  ]);

  return {
    items: items.map((row) => ({
      id: row.id,
      status: row.status,
      amountMinor: row.amountMinor,
      billingInterval: row.billingInterval,
      reservedAt: row.reservedAt.toISOString(),
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      company: row.company,
      payment: row.payment,
    })),
    page,
    pageSize: REDEMPTION_PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / REDEMPTION_PAGE_SIZE),
  };
}
