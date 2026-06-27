import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  classifyLogResult,
  classifyLogSource,
  isStructuredLog,
  resolveEntityAdminHref,
  shortenEntityId,
} from "@/lib/admin/system-logs/system-log-classify";
import {
  maskEntityIdForExport,
  redactSystemLogMessage,
  redactSystemLogMetadata,
} from "@/lib/admin/system-logs/system-log-privacy";
import type { SystemLogListFilters, SystemLogSort } from "@/lib/admin/system-logs/system-log-types";
import { maskIp } from "@/lib/admin/plans/admin-plan-activity-scope";

const LIST_SELECT = {
  id: true,
  createdAt: true,
  action: true,
  module: true,
  message: true,
  entityType: true,
  entityId: true,
  companyId: true,
  userId: true,
  user: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.ActivityLogSelect;

type ListRow = Prisma.ActivityLogGetPayload<{ select: typeof LIST_SELECT }>;

function parseDateStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(23, 59, 59, 999);
  return d;
}

function adminModuleWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [{ module: { startsWith: "admin-" } }, { module: "admin" }],
  };
}

function cronModuleWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { module: { contains: "cron", mode: "insensitive" } },
      { action: { contains: "CRON", mode: "insensitive" } },
      { metadata: { path: ["source"], string_contains: "cron" } },
    ],
  };
}

function tenantModuleWhere(): Prisma.ActivityLogWhereInput {
  return {
    AND: [
      { companyId: { not: null } },
      { NOT: adminModuleWhere() },
      { NOT: cronModuleWhere() },
    ],
  };
}

function systemModuleWhere(): Prisma.ActivityLogWhereInput {
  return {
    AND: [{ userId: null }, { NOT: cronModuleWhere() }, { NOT: adminModuleWhere() }],
  };
}

function errorResultWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { action: { contains: "FAIL", mode: "insensitive" } },
      { action: { contains: "ERROR", mode: "insensitive" } },
      { metadata: { path: ["success"], equals: false } },
      { metadata: { path: ["result"], equals: "error" } },
      { metadata: { path: ["result"], equals: "failed" } },
    ],
  };
}

function successResultWhere(): Prisma.ActivityLogWhereInput {
  return {
    AND: [
      { NOT: errorResultWhere() },
      {
        OR: [
          { metadata: { path: ["success"], equals: true } },
          { metadata: { path: ["result"], equals: "success" } },
          { metadata: { path: ["result"], equals: "ok" } },
          { action: { contains: "SUCCESS", mode: "insensitive" } },
        ],
      },
    ],
  };
}

function securityWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { module: { contains: "auth", mode: "insensitive" } },
      { action: { contains: "LOGIN", mode: "insensitive" } },
      { action: { contains: "PASSWORD", mode: "insensitive" } },
      { action: { contains: "SESSION", mode: "insensitive" } },
    ],
  };
}

function paymentWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { module: { contains: "payment", mode: "insensitive" } },
      { module: { contains: "subscription", mode: "insensitive" } },
      { module: { startsWith: "admin-payment" } },
      { module: { startsWith: "admin-subscription" } },
      { action: { contains: "PAYMENT", mode: "insensitive" } },
      { action: { contains: "REFUND", mode: "insensitive" } },
    ],
  };
}

function partnerWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [
      { module: { startsWith: "admin-partner" } },
      { module: { startsWith: "admin-partners" } },
    ],
  };
}

function legacyWhere(): Prisma.ActivityLogWhereInput {
  return {
    OR: [{ entityType: null }, { entityId: null }],
  };
}

function structuredWhere(): Prisma.ActivityLogWhereInput {
  return {
    AND: [{ entityType: { not: null } }, { entityId: { not: null } }],
  };
}

export function buildSystemLogWhere(filters: SystemLogListFilters): Prisma.ActivityLogWhereInput {
  const and: Prisma.ActivityLogWhereInput[] = [];

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { module: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { company: { name: { contains: q, mode: "insensitive" } } },
        { company: { id: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const from = parseDateStart(filters.dateFrom);
  const to = parseDateEnd(filters.dateTo);
  if (from || to) {
    and.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  if (filters.action) and.push({ action: filters.action });
  if (filters.module) and.push({ module: filters.module });
  if (filters.entityType) and.push({ entityType: filters.entityType });
  if (filters.actorId) and.push({ userId: filters.actorId });
  if (filters.companyId) and.push({ companyId: filters.companyId });

  if (filters.result === "error") and.push(errorResultWhere());
  if (filters.result === "success") and.push(successResultWhere());
  if (filters.result === "unknown") {
    and.push({ NOT: { OR: [errorResultWhere(), successResultWhere()] } });
  }

  if (filters.source === "ADMIN") and.push(adminModuleWhere());
  if (filters.source === "TENANT") and.push(tenantModuleWhere());
  if (filters.source === "SYSTEM") and.push(systemModuleWhere());
  if (filters.source === "CRON") and.push(cronModuleWhere());

  if (filters.scope === "structured") and.push(structuredWhere());
  if (filters.scope === "legacy") and.push(legacyWhere());

  return and.length ? { AND: and } : {};
}

function buildOrderBy(sort: SystemLogSort): Prisma.ActivityLogOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "action_asc":
      return { action: "asc" };
    case "action_desc":
      return { action: "desc" };
    case "module_asc":
      return { module: "asc" };
    case "module_desc":
      return { module: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

function serializeListItem(row: ListRow) {
  const classifyInput = {
    module: row.module,
    action: row.action,
    userId: row.userId,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: null,
  };

  const structured = isStructuredLog(row);
  const entityHref = structured ? resolveEntityAdminHref(row.entityType, row.entityId) : null;

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    module: row.module,
    actor: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    company: row.company ? { id: row.company.id, name: row.company.name } : null,
    entityType: row.entityType,
    entityIdShort: shortenEntityId(row.entityId),
    entityHref,
    source: classifyLogSource(classifyInput),
    result: classifyLogResult(classifyInput),
    scope: structured ? ("structured" as const) : ("legacy" as const),
    summary: redactSystemLogMessage(row.message),
  };
}

export async function listSystemLogs(filters: SystemLogListFilters) {
  const where = buildSystemLogWhere(filters);
  const skip = (filters.page - 1) * filters.pageSize;

  const [total, rows] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip,
      take: filters.pageSize,
      select: LIST_SELECT,
    }),
  ]);

  return {
    items: rows.map(serializeListItem),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    },
  };
}

export async function getSystemLogDetail(id: string) {
  const row = await db.activityLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
    },
  });

  if (!row) return null;

  const classifyInput = {
    module: row.module,
    action: row.action,
    userId: row.userId,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata,
  };

  const structured = isStructuredLog(row);
  const entityHref = structured ? resolveEntityAdminHref(row.entityType, row.entityId) : null;

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    module: row.module,
    actor: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    company: row.company ? { id: row.company.id, name: row.company.name } : null,
    entityType: row.entityType,
    entityId: row.entityId,
    entityIdShort: shortenEntityId(row.entityId),
    entityHref,
    source: classifyLogSource(classifyInput),
    result: classifyLogResult(classifyInput),
    scope: structured ? ("structured" as const) : ("legacy" as const),
    ipMasked: row.ip ? maskIp(row.ip) : null,
    message: redactSystemLogMessage(row.message),
    metadata: redactSystemLogMetadata(row.metadata),
  };
}

export type SystemLogMetricKey =
  | "last24h"
  | "admin"
  | "systemCron"
  | "errors"
  | "security"
  | "payment"
  | "partner"
  | "legacy";

export async function getSystemLogMetrics(): Promise<
  Array<{ key: SystemLogMetricKey; label: string; count: number; filter: Record<string, string> }>
> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    last24h,
    admin,
    systemCron,
    errors,
    security,
    payment,
    partner,
    legacy,
  ] = await Promise.all([
    db.activityLog.count({ where: { createdAt: { gte: since } } }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, adminModuleWhere()] } }),
    db.activityLog.count({
      where: {
        AND: [
          { createdAt: { gte: since } },
          { OR: [systemModuleWhere(), cronModuleWhere()] },
        ],
      },
    }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, errorResultWhere()] } }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, securityWhere()] } }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, paymentWhere()] } }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, partnerWhere()] } }),
    db.activityLog.count({ where: { AND: [{ createdAt: { gte: since } }, legacyWhere()] } }),
  ]);

  return [
    { key: "last24h", label: "Son 24 saat", count: last24h, filter: {} },
    { key: "admin", label: "Admin işlemleri", count: admin, filter: { source: "ADMIN" } },
    {
      key: "systemCron",
      label: "Sistem / cron",
      count: systemCron,
      filter: { source: "SYSTEM" },
    },
    { key: "errors", label: "Hatalı işlemler", count: errors, filter: { result: "error" } },
    { key: "security", label: "Güvenlik / auth", count: security, filter: { module: "auth" } },
    { key: "payment", label: "Ödeme / billing", count: payment, filter: { module: "admin-payments" } },
    { key: "partner", label: "Partner", count: partner, filter: { module: "admin-partners" } },
    { key: "legacy", label: "Legacy kayıtlar", count: legacy, filter: { scope: "legacy" } },
  ];
}

export async function listDistinctSystemLogModules(limit = 50) {
  const rows = await db.activityLog.groupBy({
    by: ["module"],
    _count: { module: true },
    orderBy: { _count: { module: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.module);
}

export async function listDistinctSystemLogActions(limit = 80) {
  const rows = await db.activityLog.groupBy({
    by: ["action"],
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.action);
}

export function serializeSystemLogCsvRow(row: ListRow) {
  const classifyInput = {
    module: row.module,
    action: row.action,
    userId: row.userId,
    companyId: row.companyId,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: null,
  };

  return {
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    module: row.module,
    actor: row.user?.email ?? row.user?.name ?? "",
    company: row.company?.name ?? "",
    entityType: row.entityType ?? "",
    entityId: maskEntityIdForExport(row.entityId),
    source: classifyLogSource(classifyInput),
    result: classifyLogResult(classifyInput),
    message: redactSystemLogMessage(row.message),
  };
}
