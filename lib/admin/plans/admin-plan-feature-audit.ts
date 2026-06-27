import "server-only";

import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

export type PlanFeatureAuditAction =
  | "PLAN_FEATURE_CREATED"
  | "PLAN_FEATURE_UPDATED"
  | "PLAN_FEATURE_VISIBILITY_CHANGED"
  | "PLAN_FEATURE_HIGHLIGHT_CHANGED"
  | "PLAN_FEATURE_REORDERED"
  | "PLAN_FEATURE_DELETED";

type AuditMeta = {
  planId: string;
  featureId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
};

function safeFeatureSnapshot(row: {
  id: string;
  label: string;
  shortDescription: string | null;
  iconKey: string | null;
  sortOrder: number;
  isHighlighted: boolean;
  isVisible: boolean;
}) {
  return {
    id: row.id,
    title: row.label,
    shortDescription: row.shortDescription,
    iconKey: row.iconKey,
    sortOrder: row.sortOrder,
    isHighlighted: row.isHighlighted,
    isVisible: row.isVisible,
  };
}

export async function logPlanFeatureAudit(input: {
  adminUserId: string;
  action: PlanFeatureAuditAction;
  meta: AuditMeta;
}) {
  const featureId = input.meta.featureId ?? input.meta.planId;
  await logAdminPlanAudit({
    userId: input.adminUserId,
    action: input.action,
    planId: input.meta.planId,
    entityType: "PlanFeature",
    entityId: featureId,
    displayMessage: `Plan özelliği: ${input.action}`,
    metadata: {
      featureId: input.meta.featureId,
      before: input.meta.before,
      after: input.meta.after,
      reason: input.meta.reason,
    },
  });
}

export { safeFeatureSnapshot };
