import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AdminPlanActivityQuery } from "@/lib/admin/plans/admin-plan-schemas";
import {
  belongsToPlanActivity,
  buildStructuredPlanActivityWhere,
  maskIp,
  redactActivityForResponse,
  type ActivityLogScopeRow,
} from "@/lib/admin/plans/admin-plan-activity-scope";
import { normalizeTabPage } from "@/lib/admin/plans/admin-plan-tab-query-utils";

export async function getAdminPlanActivityTab(planId: string, query: AdminPlanActivityQuery) {
  const plan = await db.membershipPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) return null;

  const page = normalizeTabPage(query.activityPage ?? query.page);
  const pageSize = query.pageSize;
  const skip = (page - 1) * pageSize;

  const moduleFilter = query.module && query.module !== "ALL" ? query.module : "admin-plans";

  const structuredWhere = buildStructuredPlanActivityWhere(planId, moduleFilter);
  const extraFilters: Record<string, unknown> = {};
  if (query.action) extraFilters.action = { contains: query.action, mode: "insensitive" };
  if (query.adminUserId) extraFilters.userId = query.adminUserId;
  if (query.dateFrom || query.dateTo) {
    extraFilters.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  const [structuredLogs, legacyCandidates] = await Promise.all([
    db.activityLog.findMany({
      where: { ...structuredWhere, ...extraFilters },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.activityLog.findMany({
      where: {
        module: moduleFilter,
        entityType: null,
        metadata: { equals: Prisma.DbNull },
        ...extraFilters,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const scopedRows: ActivityLogScopeRow[] = [];
  const seen = new Set<string>();

  for (const log of structuredLogs) {
    scopedRows.push({
      id: log.id,
      action: log.action,
      module: log.module,
      message: log.message,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
    });
    seen.add(log.id);
  }

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
      scopedRows.push(row);
      seen.add(log.id);
    }
  }

  let filtered = scopedRows;
  if (query.success === "SUCCESS") {
    filtered = filtered.filter((r) => !r.action.includes("FAILED"));
  } else if (query.success === "ERROR") {
    filtered = filtered.filter((r) => r.action.includes("FAILED"));
  }

  filtered.sort((a, b) => {
    const logA = structuredLogs.find((l) => l.id === a.id) ?? legacyCandidates.find((l) => l.id === a.id);
    const logB = structuredLogs.find((l) => l.id === b.id) ?? legacyCandidates.find((l) => l.id === b.id);
    const ta = logA?.createdAt.getTime() ?? 0;
    const tb = logB?.createdAt.getTime() ?? 0;
    return tb - ta;
  });

  const total = filtered.length;
  const pageRows = filtered.slice(skip, skip + pageSize);

  const logById = new Map(
    [...structuredLogs, ...legacyCandidates].map((l) => [l.id, l] as const)
  );

  type ActivityLogRow = (typeof structuredLogs)[number];

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: pageRows.map((row) => {
      const log = logById.get(row.id) as ActivityLogRow | undefined;
      if (!log) {
        return {
          id: row.id,
          occurredAt: new Date(0).toISOString(),
          action: row.action,
          module: row.module,
          admin: null,
          source: "SYSTEM",
          scopeSource: "structured" as const,
          success: !row.action.includes("FAILED"),
          ipMasked: null,
          description: redactActivityForResponse({ message: row.message, metadata: row.metadata }),
          entityHint: row.entityType ? `${row.entityType}:${row.entityId?.slice(0, 8)}` : null,
        };
      }
      const isLegacy = !row.entityType && row.metadata == null;
      return {
        id: row.id,
        occurredAt: log.createdAt.toISOString(),
        action: row.action,
        module: row.module,
        admin: log.user
          ? { id: log.user.id, name: log.user.name, email: log.user.email, href: `/admin/users/${log.user.id}` }
          : null,
        source: log.userId ? "ADMIN" : "SYSTEM",
        scopeSource: isLegacy ? "legacy_inferred" : "structured",
        success: !row.action.includes("FAILED"),
        ipMasked: log.ip ? maskIp(log.ip) : null,
        description: redactActivityForResponse({ message: row.message, metadata: row.metadata }),
        entityHint: row.entityType ? `${row.entityType}:${row.entityId?.slice(0, 8)}` : null,
      };
    }),
  };
}
