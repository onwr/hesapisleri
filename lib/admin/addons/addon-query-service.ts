import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AddOnListFilters } from "@/lib/admin/addons/addon-types";
import { DEFAULT_ADDON_PAGE_SIZE } from "@/lib/admin/addons/addon-types";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import {
  detectAddOnIssues,
  type AddOnIssue,
} from "@/lib/admin/addons/admin-addon-issue-service";
import {
  buildStructuredAddOnActivityWhere,
  matchesStructuredAddOnScope,
  parseMetadata,
} from "@/lib/admin/addons/admin-addon-activity-scope";
import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";
import { findEffectiveAddOnPricesAt } from "@/lib/admin/addons/admin-addon-price-resolution-utils";

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

async function countActiveSubsByAddOn() {
  const rows = await db.companyAddOnSubscription.groupBy({
    by: ["addOnId"],
    where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.addOnId, r._count._all]));
}

export async function getAddOnSummary() {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 86_400_000);

  const [total, draft, active, archived, allRows, activeSubsMap] = await Promise.all([
    db.membershipAddOn.count(),
    db.membershipAddOn.count({ where: { status: "DRAFT" } }),
    db.membershipAddOn.count({ where: { status: "ACTIVE" } }),
    db.membershipAddOn.count({ where: { status: "ARCHIVED" } }),
    db.membershipAddOn.findMany({
      include: {
        prices: true,
        _count: {
          select: {
            subscriptions: {
              where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
            },
          },
        },
      },
    }),
    countActiveSubsByAddOn(),
  ]);

  let free = 0;
  let paid = 0;
  let withActiveSubs = 0;
  let neverUsed = 0;
  let missingPrice = 0;
  let entitlementIssues = 0;
  let upcomingPrice = 0;

  for (const row of allRows) {
    const activeSubCount = activeSubsMap.get(row.id) ?? row._count.subscriptions;
    if (activeSubCount > 0) withActiveSubs += 1;
    else neverUsed += 1;

    const effectivePrices = row.prices.filter((p) => p.status === "ACTIVE");
    const hasCurrent = effectivePrices.some((p) => {
      if (p.effectiveFrom > now) return false;
      if (p.effectiveUntil && p.effectiveUntil <= now) return false;
      return true;
    });
    const hasFree = effectivePrices.some((p) => p.salePriceMinor === 0 && p.effectiveFrom <= now);
    if (hasFree) free += 1;
    else if (hasCurrent) paid += 1;

    if (row.status === "ACTIVE" && !hasCurrent && !hasFree) missingPrice += 1;

    const hasUpcoming = row.prices.some(
      (p) => p.effectiveFrom > now && p.effectiveFrom <= soon
    );
    if (hasUpcoming) upcomingPrice += 1;

    const issues = await detectAddOnIssues({
      id: row.id,
      status: row.status,
      type: row.type,
      currency: row.currency,
      entitlementCode: row.entitlementCode,
      entitlementQuantity: row.entitlementQuantity,
      prices: row.prices,
      activeSubscriptionCount: activeSubCount,
      now,
    });
    if (
      issues.some((i) =>
        ["UNKNOWN_ENTITLEMENT", "ENTITLEMENT_TYPE_MISMATCH", "INVALID_QUANTITY"].includes(i.code)
      )
    ) {
      entitlementIssues += 1;
    }
  }

  return {
    total,
    draft,
    active,
    archived,
    free,
    paid,
    withActiveSubs,
    neverUsed,
    missingPrice,
    entitlementIssues,
    upcomingPrice,
  };
}

export async function listAddOns(filters: AddOnListFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_ADDON_PAGE_SIZE;
  const where = buildWhere(filters);
  const order = filters.order === "desc" ? "desc" : "asc";
  const orderBy: Prisma.MembershipAddOnOrderByWithRelationInput =
    filters.sort === "updated"
      ? { updatedAt: order }
      : filters.sort === "created"
        ? { createdAt: order }
        : filters.sort === "type"
          ? { type: order }
          : filters.sort === "name"
            ? { name: order }
            : { sortOrder: order };

  const [total, rows, activeSubsMap] = await Promise.all([
    db.membershipAddOn.count({ where }),
    db.membershipAddOn.findMany({
      where,
      include: {
        prices: { orderBy: { version: "desc" } },
        _count: {
          select: {
            subscriptions: {
              where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    countActiveSubsByAddOn(),
  ]);

  const now = new Date();
  let mapped = await Promise.all(
    rows.map(async (row) => {
      const meta = getEntitlementMeta(row.entitlementCode);
      const activeSubCount = activeSubsMap.get(row.id) ?? row._count.subscriptions;
      const issues = await detectAddOnIssues({
        id: row.id,
        status: row.status,
        type: row.type,
        currency: row.currency,
        entitlementCode: row.entitlementCode,
        entitlementQuantity: row.entitlementQuantity,
        prices: row.prices,
        activeSubscriptionCount: activeSubCount,
        now,
      });

      const currentPrices = row.prices
        .map((p) => {
          const effective = findEffectiveAddOnPricesAt(
            row.prices,
            p.billingInterval,
            p.currency,
            now
          );
          return effective.find((e) => e.id === p.id) ? p : null;
        })
        .filter(Boolean)
        .slice(0, 3);

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        slug: row.slug,
        description: row.description,
        status: row.status,
        type: row.type,
        currency: row.currency,
        entitlementCode: row.entitlementCode,
        entitlementLabel: meta?.label ?? row.entitlementCode,
        entitlementQuantity: row.entitlementQuantity,
        isPublic: row.isPublic,
        activeCompanyCount: activeSubCount,
        prices: currentPrices.map((p) => ({
          id: p!.id,
          billingInterval: p!.billingInterval,
          salePriceMinor: p!.salePriceMinor,
          listPriceMinor: p!.listPriceMinor,
          currency: p!.currency,
          version: p!.version,
        })),
        issues,
        updatedAt: row.updatedAt.toISOString(),
      };
    })
  );

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

export async function getAddOnDetail(id: string) {
  const addOn = await db.membershipAddOn.findUnique({
    where: { id },
    include: {
      prices: { orderBy: [{ version: "desc" }, { effectiveFrom: "desc" }] },
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
  const issues = await detectAddOnIssues({
    id: addOn.id,
    status: addOn.status,
    type: addOn.type,
    currency: addOn.currency,
    entitlementCode: addOn.entitlementCode,
    entitlementQuantity: addOn.entitlementQuantity,
    prices: addOn.prices,
    activeSubscriptionCount: addOn._count.subscriptions,
  });

  const priceSubCounts = await db.companyAddOnSubscription.groupBy({
    by: ["addOnPriceId"],
    where: { addOnId: id, addOnPriceId: { not: null } },
    _count: { _all: true },
  });
  const priceUsageMap = new Map(
    priceSubCounts.map((r) => [r.addOnPriceId!, r._count._all])
  );

  return {
    addOn: {
      ...addOn,
      createdAt: addOn.createdAt.toISOString(),
      updatedAt: addOn.updatedAt.toISOString(),
      archivedAt: addOn.archivedAt?.toISOString() ?? null,
    },
    entitlement: {
      code: addOn.entitlementCode,
      label: meta?.label ?? addOn.entitlementCode,
      kind: meta?.kind ?? null,
      valueType: meta?.valueType ?? null,
      quantityPerUnit: addOn.entitlementQuantity,
      enforcement: meta?.blockingBehavior ?? "NONE",
      multipliedByQuantity: meta?.kind === "LIMIT",
    },
    prices: addOn.prices.map((p) => ({
      ...p,
      effectiveFrom: p.effectiveFrom.toISOString(),
      effectiveUntil: p.effectiveUntil?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      subscriptionCount: priceUsageMap.get(p.id) ?? 0,
    })),
    stats: {
      activeSubscriptionCount: addOn._count.subscriptions,
    },
    issues,
  };
}

export async function listAddOnSubscriptions(
  addOnId: string,
  query: { page?: number; pageSize?: number; status?: string; companyId?: string }
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = [25, 50, 100].includes(query.pageSize ?? 25)
    ? (query.pageSize as number)
    : 25;

  const where: Prisma.CompanyAddOnSubscriptionWhereInput = { addOnId };
  if (query.status) {
    where.status = query.status as Prisma.EnumCompanyAddOnSubscriptionStatusFilter;
  }
  if (query.companyId) where.companyId = query.companyId;

  const [total, rows, addOn] = await Promise.all([
    db.companyAddOnSubscription.count({ where }),
    db.companyAddOnSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true } },
        subscription: { select: { id: true, status: true } },
        addOnPrice: {
          select: {
            id: true,
            version: true,
            currency: true,
            salePriceMinor: true,
            billingInterval: true,
          },
        },
      },
    }),
    db.membershipAddOn.findUnique({
      where: { id: addOnId },
      select: { status: true, currency: true, entitlementCode: true, entitlementQuantity: true },
    }),
  ]);

  const now = new Date();

  return {
    items: rows.map((row) => {
      const issues: AddOnIssue[] = [];
      const snapshot = row.priceSnapshot as Record<string, unknown> | null;
      const entSnapshot = row.entitlementSnapshot as Record<string, unknown> | null;

      if (!row.addOnPriceId && addOn?.status === "ACTIVE") {
        issues.push({
          code: "SUBSCRIPTION_RELATION_MISSING",
          severity: "warning",
          message: "Fiyat referansı eksik.",
        });
      }
      if (row.quantity <= 0) {
        issues.push({
          code: "INVALID_QUANTITY",
          severity: "error",
          message: "Geçersiz abonelik miktarı.",
        });
      }
      if (
        addOn?.status === "ARCHIVED" &&
        ["ACTIVE", "CANCEL_AT_PERIOD_END"].includes(row.status)
      ) {
        issues.push({
          code: "ARCHIVED_WITH_ACTIVE_SUBSCRIPTIONS",
          severity: "warning",
          message: "Arşiv add-on için aktif kayıt.",
        });
      }
      if (row.currentPeriodEnd && row.currentPeriodEnd < now && row.status === "ACTIVE") {
        issues.push({
          code: "SNAPSHOT_MISMATCH",
          severity: "warning",
          message: "Süresi geçmiş ancak hâlâ aktif görünüyor.",
        });
      }
      if (
        snapshot &&
        row.addOnPrice &&
        typeof snapshot.salePriceMinor === "number" &&
        snapshot.salePriceMinor !== row.addOnPrice.salePriceMinor
      ) {
        issues.push({
          code: "SNAPSHOT_MISMATCH",
          severity: "info",
          message: "Fiyat snapshot güncel fiyattan farklı (beklenen).",
        });
      }
      if (
        entSnapshot &&
        addOn &&
        entSnapshot.entitlementCode &&
        entSnapshot.entitlementCode !== addOn.entitlementCode
      ) {
        issues.push({
          code: "SNAPSHOT_MISMATCH",
          severity: "warning",
          message: "Entitlement snapshot güncel add-on ile uyumsuz.",
        });
      }

      return {
        id: row.id,
        companyId: row.companyId,
        companyName: row.company.name,
        subscriptionId: row.subscriptionId,
        mainSubscriptionStatus: row.subscription?.status ?? null,
        quantity: row.quantity,
        status: row.status,
        billingInterval: row.billingInterval,
        currency: row.addOnPrice?.currency ?? addOn?.currency ?? null,
        priceSnapshot: snapshot,
        entitlementSnapshot: entSnapshot,
        currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
        addOnPriceId: row.addOnPriceId,
        priceVersion: row.addOnPrice?.version ?? null,
        issues,
        createdAt: row.createdAt.toISOString(),
      };
    }),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function listAddOnHistory(addOnId: string, page = 1, pageSize = 25) {
  const structuredWhere = buildStructuredAddOnActivityWhere(addOnId);
  const legacyRows = await db.activityLog.findMany({
    where: { module: "admin-addons", message: { contains: addOnId } },
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
      return matchesStructuredAddOnScope(row, addOnId) || row.entityId === addOnId;
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

export async function listAddOnActivity(addOnId: string, page = 1, pageSize = 25) {
  const where = buildStructuredAddOnActivityWhere(addOnId);
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

/** @deprecated use listAddOnSubscriptions */
export async function listAddOnCompanies(addOnId: string, page = 1) {
  const result = await listAddOnSubscriptions(addOnId, { page, pageSize: 20 });
  return {
    items: result.items.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.companyName,
      quantity: r.quantity,
      status: r.status,
      billingInterval: r.billingInterval,
      currentPeriodEnd: r.currentPeriodEnd,
      autoRenew: null,
    })),
    pagination: result.pagination,
  };
}
