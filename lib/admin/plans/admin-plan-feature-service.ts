import "server-only";

import type { PlanFeature, PlanStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  AdminPlanFeatureServiceError,
  normalizeFeatureTitle,
  type AdminPlanFeatureCreateInput,
  type AdminPlanFeatureUpdateInput,
} from "@/lib/admin/plans/admin-plan-feature-schemas";
import {
  logPlanFeatureAudit,
  safeFeatureSnapshot,
} from "@/lib/admin/plans/admin-plan-feature-audit";
import { invalidateAdminPlanFeatureCaches } from "@/lib/admin/plans/admin-plan-cache";

export type SerializedPlanFeature = {
  id: string;
  planId: string;
  title: string;
  shortDescription: string | null;
  iconKey: string | null;
  sortOrder: number;
  isHighlighted: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

function serializeFeature(row: PlanFeature): SerializedPlanFeature {
  return {
    id: row.id,
    planId: row.planId,
    title: row.label,
    shortDescription: row.shortDescription,
    iconKey: row.iconKey,
    sortOrder: row.sortOrder,
    isHighlighted: row.isHighlighted,
    isVisible: row.isVisible,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlanFeatures(planId: string) {
  return db.planFeature.findMany({
    where: { planId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getPlanFeaturesForDisplay(planId: string): Promise<string[]> {
  const features = await listPlanFeatures(planId);
  if (features.length > 0) {
    return features.filter((f) => f.isVisible).map((f) => f.label);
  }
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    select: { features: true },
  });
  return plan?.features ?? [];
}

/** Canonical: görünür PlanFeature başlıklarını legacy features[] ile senkronize eder. */
export async function syncLegacyPlanFeatures(
  planId: string,
  tx: Pick<typeof db, "planFeature" | "membershipPlan"> = db
) {
  const features = await tx.planFeature.findMany({
    where: { planId, deletedAt: null, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const titles = features.map((f) => f.label);
  await tx.membershipPlan.update({
    where: { id: planId },
    data: { features: titles },
  });
  return titles;
}

/** @deprecated syncLegacyPlanFeatures kullanın */
export async function syncLegacyFeaturesArray(planId: string) {
  return syncLegacyPlanFeatures(planId);
}

async function assertPlanExists(planId: string) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    select: { id: true, planStatus: true, features: true },
  });
  if (!plan) throw new AdminPlanFeatureServiceError("Plan bulunamadı.", 404);
  return plan;
}

async function assertNoDuplicateTitle(
  planId: string,
  title: string,
  excludeFeatureId?: string
) {
  const normalized = normalizeFeatureTitle(title);
  const existing = await db.planFeature.findMany({
    where: { planId, deletedAt: null },
    select: { id: true, label: true },
  });
  for (const row of existing) {
    if (excludeFeatureId && row.id === excludeFeatureId) continue;
    if (normalizeFeatureTitle(row.label) === normalized) {
      throw new AdminPlanFeatureServiceError("Bu planda aynı başlıkta özellik zaten var.");
    }
  }
}

function assertArchivedMutationAllowed(
  planStatus: PlanStatus,
  input: { isVisible?: boolean; isCreate?: boolean },
  reason?: string
) {
  if (planStatus !== "ARCHIVED") return;
  if (input.isCreate) {
    throw new AdminPlanFeatureServiceError(
      "Arşivli planda yeni özellik oluşturulamaz.",
      403
    );
  }
  if (input.isVisible === true && !reason) {
    throw new AdminPlanFeatureServiceError(
      "Arşivli planda görünürlük açmak için sebep gerekli.",
      403
    );
  }
}

export async function getAdminPlanFeaturesTabData(planId: string) {
  const plan = await assertPlanExists(planId);
  const features = await listPlanFeatures(planId);
  const serialized = features.map(serializeFeature);
  const legacyTitles = plan.features ?? [];
  const visibleTitles = serialized.filter((f) => f.isVisible).map((f) => f.title);
  const legacyInSync =
    legacyTitles.length === visibleTitles.length &&
    legacyTitles.every((t, i) => t === visibleTitles[i]);

  const lastUpdated = features.reduce<Date | null>((max, f) => {
    if (!max || f.updatedAt > max) return f.updatedAt;
    return max;
  }, null);

  return {
    planStatus: plan.planStatus,
    summary: {
      total: serialized.length,
      visible: serialized.filter((f) => f.isVisible).length,
      hidden: serialized.filter((f) => !f.isVisible).length,
      highlighted: serialized.filter((f) => f.isHighlighted).length,
      legacyInSync,
      lastUpdatedAt: lastUpdated?.toISOString() ?? null,
    },
    features: serialized,
  };
}

export async function createAdminPlanFeature(input: {
  planId: string;
  adminUserId: string;
  data: AdminPlanFeatureCreateInput;
}) {
  const plan = await assertPlanExists(input.planId);
  assertArchivedMutationAllowed(plan.planStatus, { isCreate: true });
  await assertNoDuplicateTitle(input.planId, input.data.title);

  const maxSort = await db.planFeature.aggregate({
    where: { planId: input.planId, deletedAt: null },
    _max: { sortOrder: true },
  });
  const sortOrder = input.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10;

  const feature = await db.$transaction(async (tx) => {
    const created = await tx.planFeature.create({
      data: {
        planId: input.planId,
        label: input.data.title,
        shortDescription: input.data.shortDescription ?? null,
        iconKey: input.data.iconKey ?? null,
        sortOrder,
        isHighlighted: input.data.isHighlighted ?? false,
        isVisible: input.data.isVisible ?? true,
      },
    });
    await syncLegacyPlanFeatures(input.planId, tx);
    return created;
  });

  await logPlanFeatureAudit({
    adminUserId: input.adminUserId,
    action: "PLAN_FEATURE_CREATED",
    meta: {
      planId: input.planId,
      featureId: feature.id,
      after: safeFeatureSnapshot(feature),
    },
  });

  invalidateAdminPlanFeatureCaches(input.planId);
  return serializeFeature(feature);
}

export async function updateAdminPlanFeature(input: {
  planId: string;
  featureId: string;
  adminUserId: string;
  data: AdminPlanFeatureUpdateInput;
}) {
  const plan = await assertPlanExists(input.planId);
  const existing = await db.planFeature.findFirst({
    where: { id: input.featureId, planId: input.planId, deletedAt: null },
  });
  if (!existing) throw new AdminPlanFeatureServiceError("Özellik bulunamadı.", 404);

  if (input.data.isVisible !== undefined) {
    assertArchivedMutationAllowed(
      plan.planStatus,
      { isVisible: input.data.isVisible },
      input.data.reason
    );
  }

  if (input.data.title) {
    await assertNoDuplicateTitle(input.planId, input.data.title, input.featureId);
  }

  const before = safeFeatureSnapshot(existing);

  const feature = await db.$transaction(async (tx) => {
    const updated = await tx.planFeature.update({
      where: { id: existing.id },
      data: {
        ...(input.data.title !== undefined ? { label: input.data.title } : {}),
        ...(input.data.shortDescription !== undefined
          ? { shortDescription: input.data.shortDescription }
          : {}),
        ...(input.data.iconKey !== undefined ? { iconKey: input.data.iconKey } : {}),
        ...(input.data.sortOrder !== undefined ? { sortOrder: input.data.sortOrder } : {}),
        ...(input.data.isHighlighted !== undefined
          ? { isHighlighted: input.data.isHighlighted }
          : {}),
        ...(input.data.isVisible !== undefined ? { isVisible: input.data.isVisible } : {}),
      },
    });
    await syncLegacyPlanFeatures(input.planId, tx);
    return updated;
  });

  const after = safeFeatureSnapshot(feature);
  let action: import("@/lib/admin/plans/admin-plan-feature-audit").PlanFeatureAuditAction =
    "PLAN_FEATURE_UPDATED";
  if (
    input.data.isVisible !== undefined &&
    input.data.isVisible !== existing.isVisible &&
    Object.keys(input.data).filter((k) => k !== "reason").length === 1
  ) {
    action = "PLAN_FEATURE_VISIBILITY_CHANGED";
  } else if (
    input.data.isHighlighted !== undefined &&
    input.data.isHighlighted !== existing.isHighlighted &&
    Object.keys(input.data).filter((k) => k !== "reason").length === 1
  ) {
    action = "PLAN_FEATURE_HIGHLIGHT_CHANGED";
  }

  await logPlanFeatureAudit({
    adminUserId: input.adminUserId,
    action,
    meta: {
      planId: input.planId,
      featureId: feature.id,
      before,
      after,
      reason: input.data.reason,
    },
  });

  invalidateAdminPlanFeatureCaches(input.planId);
  return serializeFeature(feature);
}

export async function softDeleteAdminPlanFeature(input: {
  planId: string;
  featureId: string;
  adminUserId: string;
}) {
  await assertPlanExists(input.planId);
  const existing = await db.planFeature.findFirst({
    where: { id: input.featureId, planId: input.planId, deletedAt: null },
  });
  if (!existing) throw new AdminPlanFeatureServiceError("Özellik bulunamadı.", 404);

  const before = safeFeatureSnapshot(existing);

  await db.$transaction(async (tx) => {
    await tx.planFeature.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    await syncLegacyPlanFeatures(input.planId, tx);
  });

  await logPlanFeatureAudit({
    adminUserId: input.adminUserId,
    action: "PLAN_FEATURE_DELETED",
    meta: {
      planId: input.planId,
      featureId: existing.id,
      before,
    },
  });

  invalidateAdminPlanFeatureCaches(input.planId);
}

export async function reorderAdminPlanFeatures(input: {
  planId: string;
  orderedFeatureIds: string[];
  adminUserId: string;
}) {
  const ids = input.orderedFeatureIds;
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new AdminPlanFeatureServiceError("Yinelenen özellik kimliği.");
  }

  const features = await listPlanFeatures(input.planId);
  if (ids.length !== features.length) {
    throw new AdminPlanFeatureServiceError(
      "Sıralama tüm aktif özellikleri içermeli; eksik veya fazla kimlik."
    );
  }

  const featureIdSet = new Set(features.map((f) => f.id));
  for (const id of ids) {
    if (!featureIdSet.has(id)) {
      throw new AdminPlanFeatureServiceError("Özellik bu plana ait değil.");
    }
  }

  const beforeOrder = features.map((f) => ({ id: f.id, sortOrder: f.sortOrder }));

  await db.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.planFeature.update({
        where: { id: ids[i] },
        data: { sortOrder: (i + 1) * 10 },
      });
    }
    await syncLegacyPlanFeatures(input.planId, tx);
  });

  await logPlanFeatureAudit({
    adminUserId: input.adminUserId,
    action: "PLAN_FEATURE_REORDERED",
    meta: {
      planId: input.planId,
      before: { order: beforeOrder },
      after: { order: ids.map((id, i) => ({ id, sortOrder: (i + 1) * 10 })) },
    },
  });

  invalidateAdminPlanFeatureCaches(input.planId);
  return getAdminPlanFeaturesTabData(input.planId);
}
