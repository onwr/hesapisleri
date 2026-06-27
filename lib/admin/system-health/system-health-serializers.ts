import { redactHealthDetails as redactHealthDetailsInternal } from "@/lib/admin/system-health/health-redaction";
import type {
  HealthCheckResult,
  OverallHealthStatus,
} from "@/lib/admin/system-health/system-health-registry";

export { formatHealthDetailScalar, formatHealthDetailsLines } from "@/lib/admin/system-health/health-detail-format";

export function redactHealthDetails(details: Record<string, unknown>): Record<string, unknown> {
  return redactHealthDetailsInternal(details);
}

export function serializeHealthCheckResult(check: HealthCheckResult): HealthCheckResult {
  return {
    ...check,
    details: redactHealthDetails(check.details),
  };
}

export type HealthSummary = {
  overallStatus: OverallHealthStatus;
  checkedAt: string;
  totalChecks: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  notConfigured: number;
  criticalIssues: number;
  errorsLast24h: number;
};

export function buildHealthSummary(
  checks: HealthCheckResult[],
  overallStatus: OverallHealthStatus,
  errorsLast24h: number
): HealthSummary {
  const checkedAt =
    checks.length > 0
      ? checks.reduce((latest, c) => (c.checkedAt > latest ? c.checkedAt : latest), checks[0]!.checkedAt)
      : new Date().toISOString();

  return {
    overallStatus,
    checkedAt,
    totalChecks: checks.length,
    healthy: checks.filter((c) => c.status === "HEALTHY").length,
    degraded: checks.filter((c) => c.status === "DEGRADED").length,
    unhealthy: checks.filter((c) => c.status === "UNHEALTHY").length,
    unknown: checks.filter((c) => c.status === "UNKNOWN").length,
    notConfigured: checks.filter((c) => c.status === "NOT_CONFIGURED").length,
    criticalIssues: checks.filter(
      (c) => c.criticality === "critical" && (c.status === "UNHEALTHY" || c.status === "DEGRADED")
    ).length,
    errorsLast24h,
  };
}

export function probeEnvFields(
  fields: Array<{ key: string; required?: boolean; format?: RegExp }>
): { configured: boolean; missing: string[]; invalid: string[] } {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const field of fields) {
    const value = process.env[field.key]?.trim();
    if (!value) {
      if (field.required !== false) missing.push(field.key);
      continue;
    }
    if (field.format && !field.format.test(value)) {
      invalid.push(field.key);
    }
  }

  return {
    configured: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}
