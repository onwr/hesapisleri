import { roundCashMoney } from "@/lib/cash-bank-account-utils";

export type PerformanceTargetMetrics = {
  revenue: number;
  salesCount: number;
  collectionTotal: number;
  performanceScore: number;
  leaveDays: number;
  revenuePerPayrollCost: number | null;
};

export type EffectivePerformanceTarget = {
  id: string;
  scope: "employee" | "department" | "company";
  employeeId: string | null;
  department: string | null;
  periodStart: string;
  periodEnd: string;
  salesCountTarget: number | null;
  revenueTarget: number | null;
  collectionTarget: number | null;
  maxLeaveDays: number | null;
  payrollEfficiencyTarget: number | null;
  scoreTarget: number | null;
  notes: string | null;
};

export type TargetAchievement = {
  revenueAchievementPercent: number | null;
  salesCountAchievementPercent: number | null;
  collectionAchievementPercent: number | null;
  scoreAchievementPercent: number | null;
  overallAchievementPercent: number | null;
};

export function calculateAchievementPercent(actual: number, target: number | null) {
  if (target == null || target <= 0) return null;
  return Math.round(Math.min(999, Math.max(0, (actual / target) * 100)));
}

export function calculateTargetAchievement(
  performance: PerformanceTargetMetrics,
  target: EffectivePerformanceTarget | null
): TargetAchievement | null {
  if (!target) return null;

  const revenueAchievementPercent = calculateAchievementPercent(
    performance.revenue,
    target.revenueTarget
  );
  const salesCountAchievementPercent = calculateAchievementPercent(
    performance.salesCount,
    target.salesCountTarget
  );
  const collectionAchievementPercent = calculateAchievementPercent(
    performance.collectionTotal,
    target.collectionTarget
  );
  const scoreAchievementPercent = calculateAchievementPercent(
    performance.performanceScore,
    target.scoreTarget
  );

  const parts = [
    revenueAchievementPercent,
    salesCountAchievementPercent,
    collectionAchievementPercent,
    scoreAchievementPercent,
  ].filter((value): value is number => value != null);

  const overallAchievementPercent =
    parts.length > 0
      ? roundCashMoney(parts.reduce((sum, value) => sum + value, 0) / parts.length)
      : null;

  return {
    revenueAchievementPercent,
    salesCountAchievementPercent,
    collectionAchievementPercent,
    scoreAchievementPercent,
    overallAchievementPercent,
  };
}

export function getAchievementStatus(
  percent: number | null
): "success" | "approaching" | "behind" | null {
  if (percent == null) return null;
  if (percent >= 100) return "success";
  if (percent >= 75) return "approaching";
  return "behind";
}

export function getAchievementStatusLabel(
  status: ReturnType<typeof getAchievementStatus>
) {
  if (status === "success") return "Başarılı";
  if (status === "approaching") return "Yaklaşıyor";
  if (status === "behind") return "Geride";
  return "—";
}

export function pickEffectiveDepartmentTarget(
  targets: EffectivePerformanceTarget[],
  department: string
) {
  const departmentTarget = targets.find(
    (target) => target.scope === "department" && target.department === department
  );
  if (departmentTarget) return departmentTarget;

  return targets.find((target) => target.scope === "company") ?? null;
}

export function parseTargetScope(value: string | null | undefined) {
  if (value === "employee" || value === "department" || value === "company") {
    return value;
  }
  return undefined;
}

export function filterTargetsByScope<T extends { scope: EffectivePerformanceTarget["scope"] }>(
  targets: T[],
  scope?: EffectivePerformanceTarget["scope"]
) {
  if (!scope) return targets;
  return targets.filter((target) => target.scope === scope);
}

export function pickEffectiveTarget(
  targets: EffectivePerformanceTarget[],
  input: {
    employeeId: string;
    department: string | null;
  }
) {
  const employeeTarget = targets.find(
    (target) => target.scope === "employee" && target.employeeId === input.employeeId
  );
  if (employeeTarget) return employeeTarget;

  if (input.department) {
    const departmentTarget = targets.find(
      (target) =>
        target.scope === "department" && target.department === input.department
    );
    if (departmentTarget) return departmentTarget;
  }

  return targets.find((target) => target.scope === "company") ?? null;
}

export function buildPerformanceTrendPoints(
  records: Array<{
    periodStart: string;
    periodEnd: string;
    salesCount: number;
    salesTotal: number;
    taskScore: number | null;
  }>
) {
  return records
    .slice(0, 6)
    .reverse()
    .map((record) => ({
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      salesCount: record.salesCount,
      revenue: record.salesTotal,
      score: record.taskScore,
    }));
}

export function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
