import "server-only";

import type { PlanEntitlement } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  computeEntitlementDiff,
  EntitlementPreviewStaleError,
  getEnforcementDisplayStatus,
  listRegistryForAdmin,
  normalizeEntitlementRow,
  resolvePlanLevelPreview,
  type EntitlementInputRow,
  type EntitlementValidationIssue,
  assertValidEntitlementSet,
  validateEntitlementSet,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { isKnownEntitlementCode, getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import { invalidateAdminPlanEntitlementCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

function rowFromDb(row: PlanEntitlement): EntitlementInputRow {
  return {
    code: row.code,
    valueType: row.valueType,
    booleanValue: row.booleanValue,
    numberValue: row.numberValue,
    stringValue: row.stringValue,
    isUnlimited: row.isUnlimited,
    description: row.description,
    category: row.category,
    sortOrder: row.sortOrder,
  };
}

async function getLatestEntitlementVersion(planId: string) {
  return db.planEntitlementVersion.findFirst({
    where: { planId },
    orderBy: { version: "desc" },
  });
}

export async function getAdminPlanEntitlementsView(planId: string) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    include: { entitlements: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) return null;

  const published = await getLatestEntitlementVersion(planId);
  const publishedMap = new Map<string, EntitlementInputRow>();
  if (published?.entitlementsJson && Array.isArray(published.entitlementsJson)) {
    for (const raw of published.entitlementsJson as EntitlementInputRow[]) {
      publishedMap.set(raw.code.toUpperCase(), normalizeEntitlementRow(raw));
    }
  }

  const registry = listRegistryForAdmin();
  const rows = plan.entitlements.map((ent) => {
    const input = rowFromDb(ent);
    const meta = getEntitlementMeta(ent.code);
    const publishedRow = publishedMap.get(ent.code.toUpperCase()) ?? null;
    const resolved = resolvePlanLevelPreview(input, ent.code);
    return {
      code: ent.code,
      registryTitle: meta?.label ?? ent.code,
      registryDescription: meta?.description ?? null,
      valueType: ent.valueType,
      currentValue: resolved.planValue,
      publishedValue: publishedRow
        ? publishedRow.valueType === "UNLIMITED" || publishedRow.isUnlimited
          ? "Sınırsız"
          : publishedRow.valueType === "BOOLEAN"
            ? String(publishedRow.booleanValue ?? false)
            : publishedRow.valueType === "NUMBER"
              ? String(publishedRow.numberValue ?? 0)
              : (publishedRow.stringValue ?? "")
        : null,
      addonAffectable: meta?.kind === "LIMIT",
      adminOverrideSupported: true,
      resolvedPreview: resolved,
      enforcementStatus: getEnforcementDisplayStatus(ent.code),
      updatedAt: ent.updatedAt.toISOString(),
      sortOrder: ent.sortOrder,
      isUnknownCode: !isKnownEntitlementCode(ent.code),
    };
  });

  const unknownRows = plan.entitlements
    .filter((e) => !isKnownEntitlementCode(e.code))
    .map((e) => e.code);

  const issues = detectStoredEntitlementIssues(plan.entitlements);

  return {
    planStatus: plan.planStatus,
    message:
      "Plan hakları ve limitleri fiyatlandırma ve analiz amacıyla saklanır. Operasyonel kullanım engelleri devre dışıdır.",
    registry,
    entitlements: rows,
    publishedVersion: published?.version ?? 0,
    publishedAt: published?.publishedAt?.toISOString() ?? null,
    unknownCodes: unknownRows,
    issues,
  };
}

export function detectStoredEntitlementIssues(
  entitlements: PlanEntitlement[]
): EntitlementValidationIssue[] {
  const rows = entitlements.map(rowFromDb);
  const issues = validateEntitlementSet(rows);

  for (const ent of entitlements) {
    if (!isKnownEntitlementCode(ent.code)) {
      issues.push({
        code: "ENTITLEMENT_UNKNOWN_CODE",
        severity: "warning",
        message: `Kayıtlı bilinmeyen kod: ${ent.code}`,
        entitlementCode: ent.code,
      });
    }
  }

  return issues;
}

export async function previewPlanEntitlementChanges(input: {
  planId: string;
  entitlements: EntitlementInputRow[];
  baseVersion: number;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new Error("Plan bulunamadı.");

  const latest = await getLatestEntitlementVersion(input.planId);
  const currentVersion = latest?.version ?? 0;

  const current = await db.planEntitlement.findMany({
    where: { planId: input.planId },
    orderBy: { sortOrder: "asc" },
  });
  const currentRows = current.map(rowFromDb);
  const normalizedNext = input.entitlements.map(normalizeEntitlementRow);

  const validationIssues = validateEntitlementSet(normalizedNext);
  const errors = validationIssues.filter((i) => i.severity === "error");
  if (errors.length) {
    return {
      valid: false as const,
      currentVersion,
      stale: input.baseVersion !== currentVersion,
      validationIssues,
      diff: [] as ReturnType<typeof computeEntitlementDiff>,
      operationalEnforcementNote:
        "Operasyonel limit/feature engelleri bu değişiklikle etkinleştirilmez.",
    };
  }

  const diff = computeEntitlementDiff(currentRows, normalizedNext);

  return {
    valid: true as const,
    currentVersion,
    stale: input.baseVersion !== currentVersion,
    validationIssues,
    diff,
    operationalEnforcementNote:
      "Operasyonel limit/feature engelleri bu değişiklikle etkinleştirilmez.",
  };
}

async function applyPlanEntitlementSet(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  planId: string,
  entitlements: EntitlementInputRow[]
) {
  const normalized = entitlements.map(normalizeEntitlementRow);
  const codes = new Set(normalized.map((e) => e.code.toUpperCase()));

  const existing = await tx.planEntitlement.findMany({ where: { planId } });
  for (const row of existing) {
    if (!codes.has(row.code.toUpperCase())) {
      await tx.planEntitlement.delete({ where: { id: row.id } });
    }
  }

  const saved = [];
  for (const row of normalized) {
    const item = await tx.planEntitlement.upsert({
      where: { planId_code: { planId, code: row.code } },
      create: {
        planId,
        code: row.code,
        valueType: row.valueType,
        booleanValue: row.booleanValue,
        numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
        stringValue: row.stringValue,
        isUnlimited: row.isUnlimited ?? false,
        description: row.description ?? null,
        category: row.category ?? getEntitlementMeta(row.code)?.category ?? null,
        sortOrder: row.sortOrder ?? 100,
      },
      update: {
        valueType: row.valueType,
        booleanValue: row.booleanValue,
        numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
        stringValue: row.stringValue,
        isUnlimited: row.isUnlimited ?? false,
        description: row.description ?? null,
        category: row.category ?? getEntitlementMeta(row.code)?.category ?? null,
        sortOrder: row.sortOrder ?? 100,
      },
    });
    saved.push(item);
  }
  return saved;
}

export async function publishPlanEntitlementChanges(input: {
  planId: string;
  entitlements: EntitlementInputRow[];
  baseVersion: number;
  reason: string;
  changePolicy?: "NEW_SUBSCRIBERS_ONLY" | "IMMEDIATE" | "NEXT_RENEWAL" | "GRANDFATHERED";
  actorUserId: string;
}) {
  const latest = await getLatestEntitlementVersion(input.planId);
  const currentVersion = latest?.version ?? 0;
  if (input.baseVersion !== currentVersion) {
    throw new EntitlementPreviewStaleError();
  }

  const normalized = input.entitlements.map(normalizeEntitlementRow);
  assertValidEntitlementSet(normalized);

  const current = await db.planEntitlement.findMany({ where: { planId: input.planId } });
  const diff = computeEntitlementDiff(current.map(rowFromDb), normalized);

  const result = await db.$transaction(async (tx) => {
    const saved = await applyPlanEntitlementSet(tx, input.planId, normalized);

    const version = await tx.planEntitlementVersion.create({
      data: {
        planId: input.planId,
        version: currentVersion + 1,
        status: "ACTIVE",
        changePolicy: input.changePolicy ?? "NEW_SUBSCRIBERS_ONLY",
        entitlementsJson: saved,
        createdByUserId: input.actorUserId,
        publishedByUserId: input.actorUserId,
        publishedAt: new Date(),
      },
    });

    await logAdminPlanAudit({
      userId: input.actorUserId,
      action: "PLAN_ENTITLEMENT_PUBLISHED",
      planId: input.planId,
      entityType: "PlanEntitlementVersion",
      entityId: version.id,
      displayMessage: `Plan entitlement v${version.version} yayınlandı.`,
      metadata: {
        version: version.version,
        reason: input.reason,
        changeCount: diff.length,
      },
      tx,
    });

    return { saved, version };
  });

  invalidateAdminPlanEntitlementCaches(input.planId);
  return { ...result, diff, previousVersion: currentVersion };
}
