import type { HealthCheckStatus, HealthIssueCode } from "@/lib/admin/system-health/system-health-registry";

export type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export type MigrationHealthEvaluation = {
  status: HealthCheckStatus;
  summary: string;
  issues: HealthIssueCode[];
  activeFailedCount: number;
  historicalRolledBackCount: number;
  pendingCount: number;
  appliedCount: number;
};

export function isActiveFailedMigration(row: MigrationRow) {
  return row.finished_at == null && row.rolled_back_at == null;
}

export function evaluateMigrationHealth(
  rows: MigrationRow[],
  pending: string[]
): MigrationHealthEvaluation {
  const activeFailed = rows.filter(isActiveFailedMigration);
  const historicalRolledBackCount = rows.filter((r) => r.rolled_back_at != null).length;
  const appliedCount = rows.filter((r) => r.finished_at != null).length;

  const issues: HealthIssueCode[] = [];
  let status: HealthCheckStatus = "HEALTHY";
  let summary = "Migration durumu güncel.";

  if (activeFailed.length > 0) {
    status = "UNHEALTHY";
    issues.push("MIGRATION_PENDING");
    summary = `${activeFailed.length} çözülmemiş başarısız migration.`;
  } else if (pending.length > 0) {
    status = "UNHEALTHY";
    issues.push("MIGRATION_PENDING");
    summary = `${pending.length} bekleyen migration.`;
  }

  return {
    status,
    summary,
    issues,
    activeFailedCount: activeFailed.length,
    historicalRolledBackCount,
    pendingCount: pending.length,
    appliedCount,
  };
}
