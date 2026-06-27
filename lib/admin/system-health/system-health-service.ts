import "server-only";

import { db } from "@/lib/prisma";
import {
  HEALTH_CHECK_DEFINITIONS,
  aggregateOverallStatus,
} from "@/lib/admin/system-health/system-health-registry";
import {
  countHealthErrorsLast24h,
  runHealthCheckById,
} from "@/lib/admin/system-health/system-health-checks";
import {
  getCachedHealthSnapshot,
  invalidateHealthCache,
  setCachedHealthSnapshot,
  assertRunCooldown,
} from "@/lib/admin/system-health/system-health-cache";
import {
  buildHealthSummary,
  serializeHealthCheckResult,
} from "@/lib/admin/system-health/system-health-serializers";

export class AdminSystemHealthServiceError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "AdminSystemHealthServiceError";
    this.status = status;
    this.code = code;
  }
}

async function runAllChecks() {
  const settled = await Promise.allSettled(
    HEALTH_CHECK_DEFINITIONS.map((def) => runHealthCheckById(def.id))
  );

  return settled.map((result, index) => {
    const def = HEALTH_CHECK_DEFINITIONS[index]!;
    if (result.status === "fulfilled") {
      return serializeHealthCheckResult(result.value);
    }
    const message = result.reason instanceof Error ? result.reason.message : "Check başarısız";
    return serializeHealthCheckResult({
      id: def.id,
      label: def.label,
      category: def.category,
      criticality: def.criticality,
      status: "UNKNOWN",
      summary: message,
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      details: { error: message },
      suggestedAction: "Kontrolü yeniden çalıştırın.",
      issues: [],
    });
  });
}

export async function getSystemHealthSnapshot(options?: { refresh?: boolean }) {
  if (!options?.refresh) {
    const cached = getCachedHealthSnapshot();
    if (cached) {
      const overallStatus = aggregateOverallStatus(cached.checks);
      return {
        summary: buildHealthSummary(cached.checks, overallStatus, cached.errorsLast24h),
        checks: cached.checks,
        cached: true,
      };
    }
  } else {
    invalidateHealthCache();
  }

  const [checks, errorsLast24h] = await Promise.all([runAllChecks(), countHealthErrorsLast24h()]);
  setCachedHealthSnapshot(checks, errorsLast24h);

  const overallStatus = aggregateOverallStatus(checks);
  return {
    summary: buildHealthSummary(checks, overallStatus, errorsLast24h),
    checks,
    cached: false,
  };
}

export async function listSystemHealthChecks(options?: { refresh?: boolean }) {
  const snapshot = await getSystemHealthSnapshot(options);
  return snapshot;
}

export async function runSingleSystemHealthCheck(checkId: string, actorUserId?: string) {
  assertRunCooldown(checkId);
  invalidateHealthCache();

  const check = serializeHealthCheckResult(await runHealthCheckById(checkId));

  if (actorUserId) {
    try {
      await db.activityLog.create({
        data: {
          userId: actorUserId,
          action: "SYSTEM_HEALTH_CHECK_EXECUTED",
          module: "admin-system-health",
          message: `Sistem sağlık kontrolü çalıştırıldı: ${checkId}`,
          entityType: "SystemHealthCheck",
          entityId: checkId,
          metadata: {
            checkId,
            status: check.status,
            durationMs: check.durationMs,
          },
        },
      });
    } catch {
      // audit optional
    }
  }

  return check;
}
