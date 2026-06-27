import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AdminPlanHistoryQuery } from "@/lib/admin/plans/admin-plan-schemas";
import {
  buildHistoryEventId,
  categorizeEventType,
  dedupePlanHistoryEvents,
  parseActivityMessage,
  safeSummary,
  type PlanHistoryEvent,
} from "@/lib/admin/plans/admin-plan-history-utils";
import {
  belongsToPlanActivity,
  buildStructuredPlanActivityWhere,
  metadataPlanId,
  parseMetadata,
  type ActivityLogScopeRow,
} from "@/lib/admin/plans/admin-plan-activity-scope";
import { normalizeTabPage } from "@/lib/admin/plans/admin-plan-tab-query-utils";

function mapActivityToHistory(
  log: {
    id: string;
    action: string;
    message: string | null;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
    userId: string | null;
    user: { name: string | null; email: string } | null;
  },
  planId: string
): PlanHistoryEvent | null {
  const meta =
    parseMetadata(log.metadata) ??
    parseActivityMessage(log.message);
  if (metadataPlanId(meta) && metadataPlanId(meta) !== planId) return null;

  const featureId =
    typeof meta.featureId === "string"
      ? meta.featureId
      : log.entityType === "PlanFeature" && log.entityId
        ? log.entityId
        : undefined;
  const priceId =
    typeof meta.priceId === "string"
      ? meta.priceId
      : log.entityType === "MembershipPlanPrice" && log.entityId
        ? log.entityId
        : undefined;
  const noteId =
    typeof meta.noteId === "string"
      ? meta.noteId
      : log.entityType === "AdminPlanNote" && log.entityId
        ? log.entityId
        : undefined;
  const version =
    typeof meta.version === "number"
      ? String(meta.version)
      : log.entityType === "PlanEntitlementVersion" && log.entityId
        ? log.entityId
        : undefined;

  const eventId = buildHistoryEventId({
    eventType: log.action,
    planId,
    activityId: log.id,
    featureId,
    priceId,
    versionId: version,
    noteId,
  });

  return {
    eventId,
    occurredAt: log.createdAt.toISOString(),
    eventType: log.action,
    source: "AUDIT",
    category: categorizeEventType(log.action),
    actorLabel: log.user?.name ?? log.user?.email ?? "Sistem",
    actorUserId: log.userId,
    beforeSummary: safeSummary(meta.before),
    afterSummary: safeSummary(meta.after ?? meta.text),
    reason: typeof meta.reason === "string" ? meta.reason : null,
    relatedRecordId: featureId ?? priceId ?? noteId ?? version ?? null,
    relatedTab:
      log.action.includes("PRICE")
        ? "pricing"
        : log.action.includes("FEATURE")
          ? "features"
          : log.action.includes("ENTITLEMENT")
            ? "entitlements"
            : log.action.includes("NOTE")
              ? "notes"
              : null,
    success: !log.action.includes("FAILED"),
  };
}

async function fetchPlanActivityLogs(planId: string) {
  const structuredWhere = buildStructuredPlanActivityWhere(planId);
  const logInclude = { user: { select: { id: true, name: true, email: true } } } as const;
  const [structuredLogs, legacyCandidates] = await Promise.all([
    db.activityLog.findMany({
      where: structuredWhere,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: logInclude,
    }),
    db.activityLog.findMany({
      where: { module: "admin-plans", entityType: null, metadata: { equals: Prisma.DbNull } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: logInclude,
    }),
  ]);

  type ActivityLogRow = (typeof structuredLogs)[number];
  const rows: ActivityLogRow[] = [...structuredLogs];
  const seen = new Set(structuredLogs.map((l) => l.id));

  for (const log of legacyCandidates) {
    if (seen.has(log.id)) continue;
    const row: ActivityLogScopeRow = {
      id: log.id,
      action: log.action,
      module: log.module,
      message: log.message,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
    };
    if (belongsToPlanActivity(row, planId)) {
      rows.push(log);
      seen.add(log.id);
    }
  }

  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getAdminPlanHistoryTab(planId: string, query: AdminPlanHistoryQuery) {
  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) return null;

  const page = normalizeTabPage(query.historyPage ?? query.page);
  const activityLogs = await fetchPlanActivityLogs(planId);

  const publishedPriceIds = new Set<string>();
  const publishedVersionIds = new Set<string>();
  const events: PlanHistoryEvent[] = [];

  events.push({
    eventId: buildHistoryEventId({ eventType: "PLAN_CREATED", planId }),
    occurredAt: plan.createdAt.toISOString(),
    eventType: "PLAN_CREATED",
    source: "MODEL",
    category: "LIFECYCLE",
    actorLabel: "Sistem",
    actorUserId: null,
    beforeSummary: null,
    afterSummary: safeSummary({ name: plan.name, code: plan.code }),
    reason: null,
    relatedRecordId: planId,
    relatedTab: "overview",
    success: true,
  });

  for (const log of activityLogs) {
    const mapped = mapActivityToHistory(log, planId);
    if (!mapped) continue;
    if (mapped.eventType === "PLAN_PRICE_PUBLISHED" && mapped.relatedRecordId) {
      publishedPriceIds.add(mapped.relatedRecordId);
    }
    if (mapped.eventType === "PLAN_ENTITLEMENT_PUBLISHED" && mapped.relatedRecordId) {
      publishedVersionIds.add(mapped.relatedRecordId);
    }
    events.push(mapped);
  }

  const prices = await db.membershipPlanPrice.findMany({
    where: { planId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  for (const price of prices) {
    if (publishedPriceIds.has(price.id)) continue;
    const eventType =
      price.status === "ARCHIVED"
        ? "PLAN_PRICE_ARCHIVED"
        : price.status === "EXPIRED"
          ? "PLAN_PRICE_EXPIRED"
          : "PLAN_PRICE_CREATED";
    events.push({
      eventId: buildHistoryEventId({ eventType, planId, priceId: price.id }),
      occurredAt: price.createdAt.toISOString(),
      eventType,
      source: "MODEL",
      category: "PRICE",
      actorLabel: "Sistem",
      actorUserId: null,
      beforeSummary: null,
      afterSummary: safeSummary({
        interval: price.billingInterval,
        currency: price.currency,
        sale: price.salePriceMinor,
      }),
      reason: null,
      relatedRecordId: price.id,
      relatedTab: "pricing",
      success: true,
    });
  }

  const versions = await db.planEntitlementVersion.findMany({
    where: { planId },
    orderBy: { version: "desc" },
    take: 100,
  });

  for (const v of versions) {
    if (publishedVersionIds.has(v.id)) continue;
    events.push({
      eventId: buildHistoryEventId({
        eventType: "PLAN_ENTITLEMENT_PUBLISHED",
        planId,
        versionId: v.id,
      }),
      occurredAt: (v.publishedAt ?? v.createdAt).toISOString(),
      eventType: "PLAN_ENTITLEMENT_PUBLISHED",
      source: "MODEL",
      category: "ENTITLEMENT",
      actorLabel: v.publishedByUserId ? "Admin" : "Sistem",
      actorUserId: v.publishedByUserId,
      beforeSummary: null,
      afterSummary: safeSummary({ version: v.version, policy: v.changePolicy }),
      reason: null,
      relatedRecordId: v.id,
      relatedTab: "entitlements",
      success: true,
    });
  }

  let deduped = dedupePlanHistoryEvents(events);

  if (query.eventType) deduped = deduped.filter((e) => e.eventType === query.eventType);
  if (query.source !== "ALL") deduped = deduped.filter((e) => e.source === query.source);
  if (query.adminUserId) deduped = deduped.filter((e) => e.actorUserId === query.adminUserId);
  if (query.category !== "ALL") deduped = deduped.filter((e) => e.category === query.category);
  if (query.success === "SUCCESS") deduped = deduped.filter((e) => e.success);
  if (query.success === "ERROR") deduped = deduped.filter((e) => !e.success);
  if (query.dateFrom) {
    const from = new Date(query.dateFrom);
    deduped = deduped.filter((e) => new Date(e.occurredAt) >= from);
  }
  if (query.dateTo) {
    const to = new Date(query.dateTo);
    deduped = deduped.filter((e) => new Date(e.occurredAt) <= to);
  }

  const total = deduped.length;
  const skip = (page - 1) * query.pageSize;
  const items = deduped.slice(skip, skip + query.pageSize);

  return {
    total,
    page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    items,
  };
}
