import "server-only";

import type { PlanEntitlementValueType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { isKnownEntitlementCode } from "@/lib/billing/entitlements/entitlement-registry";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import {
  assertValidEntitlementSet,
  normalizeEntitlementRow,
  type EntitlementInputRow,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { invalidateAdminPlanEntitlementCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

export type PlanEntitlementUpsertInput = EntitlementInputRow;

export async function getPlanEntitlements(planId: string) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    include: { entitlements: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) return null;
  return { plan, entitlements: plan.entitlements };
}

export async function upsertPlanEntitlements(input: {
  planId: string;
  entitlements: PlanEntitlementUpsertInput[];
  actorUserId: string;
}) {
  const normalized = input.entitlements.map(normalizeEntitlementRow);
  assertValidEntitlementSet(normalized);

  const result = await db.$transaction(async (tx) => {
    const saved = [];
    for (const row of normalized) {
      const item = await tx.planEntitlement.upsert({
        where: { planId_code: { planId: input.planId, code: row.code } },
        create: {
          planId: input.planId,
          code: row.code,
          valueType: row.valueType,
          booleanValue: row.booleanValue,
          numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
          stringValue: row.stringValue,
          isUnlimited: row.isUnlimited ?? false,
          description: row.description,
          category: row.category,
          sortOrder: row.sortOrder ?? 100,
        },
        update: {
          valueType: row.valueType,
          booleanValue: row.booleanValue,
          numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
          stringValue: row.stringValue,
          isUnlimited: row.isUnlimited ?? false,
          description: row.description,
          category: row.category,
          sortOrder: row.sortOrder ?? 100,
        },
      });
      saved.push(item);
    }

    await logAdminPlanAudit({
      userId: input.actorUserId,
      action: "PLAN_ENTITLEMENT_UPDATED",
      planId: input.planId,
      entityType: "MembershipPlan",
      entityId: input.planId,
      displayMessage: `Plan entitlement güncellendi (${saved.length} kayıt)`,
      metadata: { count: saved.length },
      tx,
    });

    return saved;
  });

  invalidateAdminPlanEntitlementCaches(input.planId);
  return result;
}

export async function publishPlanEntitlements(input: {
  planId: string;
  changePolicy?: "NEW_SUBSCRIBERS_ONLY" | "IMMEDIATE" | "NEXT_RENEWAL" | "GRANDFATHERED";
  actorUserId: string;
}) {
  const entitlements = await db.planEntitlement.findMany({
    where: { planId: input.planId },
    orderBy: { sortOrder: "asc" },
  });

  const latest = await db.planEntitlementVersion.findFirst({
    where: { planId: input.planId },
    orderBy: { version: "desc" },
  });

  const version = await db.planEntitlementVersion.create({
    data: {
      planId: input.planId,
      version: (latest?.version ?? 0) + 1,
      status: "ACTIVE",
      changePolicy: input.changePolicy ?? "NEW_SUBSCRIBERS_ONLY",
      entitlementsJson: entitlements,
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
    displayMessage: `Entitlement v${version.version} yayınlandı`,
    metadata: { version: version.version, changePolicy: version.changePolicy },
  });

  invalidateAdminPlanEntitlementCaches(input.planId);
  return version;
}

export async function createCompanyEntitlementOverride(input: {
  companyId: string;
  entitlementCode: string;
  valueType: PlanEntitlementValueType;
  booleanValue?: boolean | null;
  numberValue?: number | null;
  stringValue?: string | null;
  isUnlimited?: boolean;
  startsAt?: Date;
  endsAt?: Date | null;
  reason?: string;
  actorUserId: string;
}) {
  if (!isKnownEntitlementCode(input.entitlementCode)) {
    throw new Error("Geçersiz entitlement kodu.");
  }

  const override = await db.companyEntitlementOverride.create({
    data: {
      companyId: input.companyId,
      entitlementCode: input.entitlementCode,
      valueType: input.valueType,
      booleanValue: input.booleanValue,
      numberValue: input.numberValue,
      stringValue: input.stringValue,
      isUnlimited: input.isUnlimited ?? false,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt ?? null,
      reason: input.reason,
      createdByUserId: input.actorUserId,
      status: "ACTIVE",
    },
  });

  invalidateCompanyEntitlementCache(input.companyId);

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "ENTITLEMENT_OVERRIDE_CREATED",
      module: "admin-entitlements",
      message: JSON.stringify({ overrideId: override.id, code: input.entitlementCode }),
    },
  });

  await enqueueBillingOutboxEvent({
    companyId: input.companyId,
    type: "ENTITLEMENT_OVERRIDE_STARTED",
    aggregateType: "CompanyEntitlementOverride",
    aggregateId: override.id,
    payload: { entitlementCode: input.entitlementCode },
  });

  return override;
}

export async function removeCompanyEntitlementOverride(input: {
  companyId: string;
  overrideId: string;
  actorUserId: string;
}) {
  const override = await db.companyEntitlementOverride.findFirst({
    where: { id: input.overrideId, companyId: input.companyId, status: "ACTIVE" },
  });
  if (!override) throw new Error("Override bulunamadı.");

  const updated = await db.companyEntitlementOverride.update({
    where: { id: override.id },
    data: { status: "REVOKED" },
  });

  invalidateCompanyEntitlementCache(input.companyId);

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "ENTITLEMENT_OVERRIDE_REMOVED",
      module: "admin-entitlements",
      message: JSON.stringify({ overrideId: override.id }),
    },
  });

  return updated;
}
