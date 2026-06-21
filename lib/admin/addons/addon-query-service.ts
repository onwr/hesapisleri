import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AddOnListFilters } from "@/lib/admin/addons/addon-types";
import { ADDON_PAGE_SIZE } from "@/lib/admin/addons/addon-types";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";

function buildWhere(filters: AddOnListFilters): Prisma.MembershipAddOnWhereInput {
  const where: Prisma.MembershipAddOnWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.EnumMembershipAddOnStatusFilter;
  if (filters.type) where.type = filters.type as Prisma.EnumMembershipAddOnTypeFilter;
  if (filters.entitlementCode) where.entitlementCode = filters.entitlementCode;
  if (filters.isPublic === "true") where.isPublic = true;
  if (filters.isPublic === "false") where.isPublic = false;
  if (filters.recurring === "true") where.recurringAllowed = true;
  if (filters.recurring === "false") where.recurringAllowed = false;
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {};
    if (filters.createdFrom) where.createdAt.gte = new Date(filters.createdFrom);
    if (filters.createdTo) where.createdAt.lte = new Date(filters.createdTo);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function getAddOnSummary() {
  const [total, active, recurring, oneTime, usagePack, activeCompanySubs] = await Promise.all([
    db.membershipAddOn.count(),
    db.membershipAddOn.count({ where: { status: "ACTIVE" } }),
    db.membershipAddOn.count({ where: { type: "RECURRING", status: "ACTIVE" } }),
    db.membershipAddOn.count({ where: { type: "ONE_TIME", status: "ACTIVE" } }),
    db.membershipAddOn.count({ where: { type: "USAGE_PACK", status: "ACTIVE" } }),
    db.companyAddOnSubscription.count({
      where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
    }),
  ]);

  return { total, active, recurring, oneTime, usagePack, activeCompanySubs };
}

export async function listAddOns(filters: AddOnListFilters) {
  const page = filters.page ?? 1;
  const where = buildWhere(filters);
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.MembershipAddOnOrderByWithRelationInput =
    filters.sort === "updated"
      ? { updatedAt: order }
      : filters.sort === "created"
        ? { createdAt: order }
        : filters.sort === "type"
          ? { type: order }
          : { sortOrder: order };

  const [total, rows, companyCounts] = await Promise.all([
    db.membershipAddOn.count({ where }),
    db.membershipAddOn.findMany({
      where,
      include: {
        prices: {
          where: { status: "ACTIVE" },
          orderBy: { version: "desc" },
          take: 3,
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * ADDON_PAGE_SIZE,
      take: ADDON_PAGE_SIZE,
    }),
    db.companyAddOnSubscription.groupBy({
      by: ["addOnId"],
      where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(companyCounts.map((r) => [r.addOnId, r._count._all]));

  return {
    items: rows.map((row) => {
      const meta = getEntitlementMeta(row.entitlementCode);
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        slug: row.slug,
        description: row.description,
        status: row.status,
        type: row.type,
        entitlementCode: row.entitlementCode,
        entitlementLabel: meta?.label ?? row.entitlementCode,
        entitlementQuantity: row.entitlementQuantity,
        isPublic: row.isPublic,
        isFeatured: row.isFeatured,
        recurringAllowed: row.recurringAllowed,
        activeCompanyCount: countMap.get(row.id) ?? row._count.subscriptions,
        prices: row.prices.map((p) => ({
          id: p.id,
          billingInterval: p.billingInterval,
          salePriceMinor: p.salePriceMinor,
          listPriceMinor: p.listPriceMinor,
          currency: p.currency,
          version: p.version,
        })),
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
    pagination: {
      page,
      pageSize: ADDON_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / ADDON_PAGE_SIZE)),
    },
  };
}

export async function getAddOnDetail(id: string) {
  const addOn = await db.membershipAddOn.findUnique({
    where: { id },
    include: {
      prices: { orderBy: [{ version: "desc" }, { effectiveFrom: "desc" }] },
      subscriptions: {
        where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END", "PENDING"] } },
        include: { company: { select: { id: true, name: true } } },
        take: 50,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          subscriptions: {
            where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
          },
        },
      },
    },
  });

  if (!addOn) return null;

  const meta = getEntitlementMeta(addOn.entitlementCode);
  const activePrices = addOn.prices.filter((p) => p.status === "ACTIVE");

  return {
    ...addOn,
    entitlementLabel: meta?.label ?? addOn.entitlementCode,
    activePrices,
    activeCompanyCount: addOn._count.subscriptions,
  };
}

export async function listAddOnCompanies(addOnId: string, page = 1) {
  const pageSize = 20;
  const statuses = ["ACTIVE", "CANCEL_AT_PERIOD_END", "PENDING", "PAST_DUE"] as const;
  const where = {
    addOnId,
    status: { in: [...statuses] },
  };

  const [total, rows] = await Promise.all([
    db.companyAddOnSubscription.count({ where }),
    db.companyAddOnSubscription.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      quantity: r.quantity,
      status: r.status,
      billingInterval: r.billingInterval,
      currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
      autoRenew: r.autoRenew,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
