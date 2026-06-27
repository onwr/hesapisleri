import "server-only";

import type { PlanIssue } from "@/lib/admin/plans/admin-plan-issue-service";

export type PlanListRowInput = {
  id: string;
  name: string;
  code: string;
  planStatus: import("@prisma/client").PlanStatus;
  visibility: import("@prisma/client").PlanVisibility;
  defaultCurrency: string;
  sortOrder: number;
  isFeatured: boolean;
  activeSubscriptionCount: number;
  pricingClass: import("@/lib/admin/plans/admin-plan-classification").PlanPricingClass;
  checkoutAvailable: boolean;
  issues: PlanIssue[];
  mrrByCurrency: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
};

export function filterPlanRowsByQuery(
  rows: PlanListRowInput[],
  query: import("@/lib/admin/plans/admin-plan-schemas").AdminPlanListQuery
): PlanListRowInput[] {
  let filtered = rows;

  if (query.pricingClass !== "ALL") {
    filtered = filtered.filter((r) => r.pricingClass === query.pricingClass);
  }

  if (query.checkout === "AVAILABLE") {
    filtered = filtered.filter((r) => r.checkoutAvailable);
  } else if (query.checkout === "UNAVAILABLE") {
    filtered = filtered.filter((r) => !r.checkoutAvailable);
  }

  if (query.issue?.trim()) {
    const issueFilter = query.issue.trim();
    filtered = filtered.filter((r) => r.issues.some((i) => i.code === issueFilter));
  }

  return filtered;
}

export function paginatePlanRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const skip = (page - 1) * pageSize;
  return {
    total,
    items: rows.slice(skip, skip + pageSize),
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
