import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  assertValidEntitlementSet,
  normalizeEntitlementRow,
  type EntitlementInputRow,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import { validateIconKey } from "@/lib/admin/plans/admin-plan-feature-schemas";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import { syncLegacyPlanFeatures } from "@/lib/admin/plans/admin-plan-feature-service";
import {
  invalidateAdminPlanCaches,
  invalidateAdminPlanEntitlementCaches,
  invalidateAdminPlanFeatureCaches,
} from "@/lib/admin/plans/admin-plan-cache";
import {
  AdminPlanPatchValidationError,
  adminPlanCreateSchema,
  assertNoForbiddenPlanCreateKeys,
  type AdminPlanCreateInput,
} from "@/lib/admin/plans/admin-plan-schemas";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { assertPlanCodeAvailable } from "@/lib/admin/plans/admin-plan-code-utils";
import {
  getExistingCreatePlanId,
  recordCreatePlanIdempotency,
} from "@/lib/admin/plans/admin-plan-create-idempotency";

export class AdminPlanCreateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPlanCreateError";
    this.status = status;
  }
}

async function upsertEntitlementsInTx(
  tx: Prisma.TransactionClient,
  planId: string,
  rows: EntitlementInputRow[]
) {
  const normalized = rows.map(normalizeEntitlementRow);
  const saved = [];
  for (const row of normalized) {
    const item = await tx.planEntitlement.create({
      data: {
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
    });
    saved.push(item);
  }
  return saved;
}

export async function createAdminPlanDraft(rawBody: unknown, actorUserId: string) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new AdminPlanCreateError("Geçersiz istek gövdesi.");
  }
  const body = rawBody as Record<string, unknown>;
  assertNoForbiddenPlanCreateKeys(body);

  const parsed = adminPlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPlanPatchValidationError(
      parsed.error.issues.map((i) => i.message).join("; ")
    );
  }

  const input: AdminPlanCreateInput = parsed.data;

  const existingId = getExistingCreatePlanId(input.clientRequestId);
  if (existingId) {
    const plan = await db.membershipPlan.findUnique({ where: { id: existingId } });
    if (plan) return plan;
  }

  const code = await assertPlanCodeAvailable(input.code);
  const normalizedEntitlements = input.entitlements.map(normalizeEntitlementRow);
  assertValidEntitlementSet(normalizedEntitlements);

  for (const feature of input.features) {
    validateIconKey(feature.iconKey);
  }

  const plan = await db.$transaction(async (tx) => {
    const created = await tx.membershipPlan.create({
      data: {
        name: input.name,
        code,
        slug: code,
        description: input.description ?? null,
        planStatus: "DRAFT",
        visibility: input.visibility,
        isFeatured: false,
        sortOrder: input.sortOrder,
        trialEnabled: input.trialEnabled,
        trialDays: input.trialDays,
        defaultCurrency: input.defaultCurrency,
        currency: input.defaultCurrency,
        vatRate: 20,
        vatIncluded: false,
        monthlyPrice: 0,
        quarterlyPrice: 0,
        semiAnnualPrice: 0,
        yearlyPrice: 0,
        isActive: false,
        features: [],
        publishedAt: null,
        archivedAt: null,
      },
    });

    for (const feature of input.features) {
      await tx.planFeature.create({
        data: {
          planId: created.id,
          label: feature.title,
          shortDescription: feature.shortDescription,
          iconKey: validateIconKey(feature.iconKey),
          sortOrder: feature.sortOrder,
          isHighlighted: feature.isHighlighted,
          isVisible: feature.isVisible,
        },
      });
    }

    await syncLegacyPlanFeatures(created.id, tx);

    const savedEntitlements = await upsertEntitlementsInTx(tx, created.id, normalizedEntitlements);

    await tx.planEntitlementVersion.create({
      data: {
        planId: created.id,
        version: 1,
        status: "ACTIVE",
        changePolicy: "NEW_SUBSCRIBERS_ONLY",
        entitlementsJson: savedEntitlements,
        createdByUserId: actorUserId,
        publishedByUserId: actorUserId,
        publishedAt: new Date(),
      },
    });

    await logAdminPlanAudit({
      userId: actorUserId,
      action: "PLAN_CREATED",
      planId: created.id,
      entityType: "MembershipPlan",
      entityId: created.id,
      displayMessage: `Plan taslak olarak oluşturuldu: ${created.name}`,
      metadata: {
        code: created.code,
        featureCount: input.features.length,
        entitlementCount: savedEntitlements.length,
        visibility: created.visibility,
      },
      tx,
    });

    return created;
  });

  recordCreatePlanIdempotency(input.clientRequestId, plan.id);
  invalidateAdminPlanCaches(plan.id);
  invalidateAdminPlanFeatureCaches(plan.id);
  invalidateAdminPlanEntitlementCaches(plan.id);

  return plan;
}
