import "server-only";

import { db } from "@/lib/prisma";
import {
  normalizeEntitlementRow,
  type EntitlementInputRow,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import { syncLegacyPlanFeatures } from "@/lib/admin/plans/admin-plan-feature-service";
import {
  invalidateAdminPlanCaches,
  invalidateAdminPlanEntitlementCaches,
  invalidateAdminPlanFeatureCaches,
} from "@/lib/admin/plans/admin-plan-cache";
import {
  AdminPlanPatchValidationError,
  adminPlanCloneSchema,
  type AdminPlanCloneInput,
} from "@/lib/admin/plans/admin-plan-schemas";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { assertPlanCodeAvailable } from "@/lib/admin/plans/admin-plan-code-utils";
import {
  mapClonedPriceRow,
  pickPricesToClone,
} from "@/lib/admin/plans/admin-plan-clone-utils";

export class AdminPlanCloneError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPlanCloneError";
    this.status = status;
  }
}

function entitlementRowFromDb(row: {
  code: string;
  valueType: EntitlementInputRow["valueType"];
  booleanValue: boolean | null;
  numberValue: number | null;
  stringValue: string | null;
  isUnlimited: boolean;
  description: string | null;
  category: string | null;
  sortOrder: number;
}): EntitlementInputRow {
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

export async function cloneAdminPlan(
  sourcePlanId: string,
  rawBody: unknown,
  actorUserId: string
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new AdminPlanCloneError("Geçersiz istek gövdesi.");
  }
  if ("planId" in (rawBody as Record<string, unknown>)) {
    throw new AdminPlanCloneError("planId gövdeden kabul edilmez.", 400);
  }

  const parsed = adminPlanCloneSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new AdminPlanPatchValidationError(
      parsed.error.issues.map((i) => i.message).join("; ")
    );
  }

  const input: AdminPlanCloneInput = parsed.data;
  const code = await assertPlanCodeAvailable(input.code);

  const source = await db.membershipPlan.findUnique({
    where: { id: sourcePlanId },
    include: {
      planFeatures: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      entitlements: { orderBy: { sortOrder: "asc" } },
      prices: { orderBy: [{ billingInterval: "asc" }, { version: "desc" }] },
      _count: {
        select: {
          subscriptions: true,
          payments: true,
          adminNotes: true,
        },
      },
    },
  });

  if (!source) {
    throw new AdminPlanServiceError("Kaynak plan bulunamadı.", 404);
  }

  const cloned = await db.$transaction(async (tx) => {
    const plan = await tx.membershipPlan.create({
      data: {
        name: input.name,
        code,
        slug: code,
        description: input.description ?? source.description,
        shortDescription: source.shortDescription,
        badgeText: source.badgeText,
        planStatus: "DRAFT",
        visibility: "INTERNAL",
        isFeatured: false,
        sortOrder: source.sortOrder,
        trialEnabled: source.trialEnabled,
        trialDays: source.trialDays,
        autoRenewAllowed: source.autoRenewAllowed,
        upgradeAllowed: source.upgradeAllowed,
        downgradeAllowed: source.downgradeAllowed,
        cancellationAllowed: source.cancellationAllowed,
        gracePeriodDays: source.gracePeriodDays,
        defaultCurrency: source.defaultCurrency,
        currency: source.defaultCurrency,
        vatRate: source.vatRate,
        vatIncluded: source.vatIncluded,
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

    let featureCount = 0;
    if (input.copyFeatures) {
      for (const feature of source.planFeatures) {
        await tx.planFeature.create({
          data: {
            planId: plan.id,
            label: feature.label,
            shortDescription: feature.shortDescription,
            iconKey: feature.iconKey,
            sortOrder: feature.sortOrder,
            isHighlighted: feature.isHighlighted,
            isVisible: feature.isVisible,
          },
        });
        featureCount++;
      }
      await syncLegacyPlanFeatures(plan.id, tx);
    }

    let entitlementCount = 0;
    if (input.copyEntitlements && source.entitlements.length > 0) {
      const saved = [];
      for (const ent of source.entitlements) {
        const row = normalizeEntitlementRow(entitlementRowFromDb(ent));
        const item = await tx.planEntitlement.create({
          data: {
            planId: plan.id,
            code: row.code,
            valueType: row.valueType,
            booleanValue: row.booleanValue,
            numberValue: row.numberValue != null ? Math.trunc(row.numberValue) : null,
            stringValue: row.stringValue,
            isUnlimited: row.isUnlimited ?? false,
            description: row.description ?? null,
            category: row.category,
            sortOrder: row.sortOrder ?? 100,
          },
        });
        saved.push(item);
        entitlementCount++;
      }

      await tx.planEntitlementVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          status: "ACTIVE",
          changePolicy: "NEW_SUBSCRIBERS_ONLY",
          entitlementsJson: saved,
          createdByUserId: actorUserId,
          publishedByUserId: actorUserId,
          publishedAt: new Date(),
        },
      });
    }

    let priceCount = 0;
    if (input.copyPricesAsDraft && source.prices.length > 0) {
      const toCopy = pickPricesToClone(source.prices);
      for (const price of toCopy) {
        await tx.membershipPlanPrice.create({
          data: mapClonedPriceRow(price, plan.id, actorUserId),
        });
        priceCount++;
      }
    }

    await logAdminPlanAudit({
      userId: actorUserId,
      action: "PLAN_CLONED",
      planId: plan.id,
      entityType: "MembershipPlan",
      entityId: plan.id,
      displayMessage: `Plan kopyalandı: ${source.name} → ${plan.name}`,
      metadata: {
        sourcePlanId: source.id,
        clonedPlanId: plan.id,
        sourceCode: source.code,
        newCode: plan.code,
        copyFeatures: input.copyFeatures,
        copyEntitlements: input.copyEntitlements,
        copyPricesAsDraft: input.copyPricesAsDraft,
        featureCount,
        entitlementCount,
        priceCount,
        reason: input.reason,
      },
      tx,
    });

    return {
      plan,
      meta: {
        sourcePlanId: source.id,
        featureCount,
        entitlementCount,
        priceCount,
        sourceSubscriptions: source._count.subscriptions,
        sourcePayments: source._count.payments,
        sourceNotes: source._count.adminNotes,
      },
    };
  });

  invalidateAdminPlanCaches(cloned.plan.id);
  if (input.copyFeatures) invalidateAdminPlanFeatureCaches(cloned.plan.id);
  if (input.copyEntitlements) invalidateAdminPlanEntitlementCaches(cloned.plan.id);

  return cloned;
}
