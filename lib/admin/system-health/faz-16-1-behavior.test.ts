/**
 * Faz 16.1 — Sistem sağlığı doğruluk düzeltmeleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { JOB_REGISTRY } from "@/lib/admin/jobs/job-registry";
import {
  countStuckOutboxPending,
  evaluateCronHealth,
} from "@/lib/admin/system-health/health-cron-utils";
import {
  formatHealthDetailEntry,
  formatHealthDetailScalar,
  formatHealthDetailsLines,
} from "@/lib/admin/system-health/health-detail-format";
import {
  evaluateMigrationHealth,
  isActiveFailedMigration,
} from "@/lib/admin/system-health/health-migration-utils";
import {
  captureMemorySnapshot,
  evaluateMemoryHealth,
} from "@/lib/admin/system-health/health-memory-utils";
import { redactHealthDetails } from "@/lib/admin/system-health/health-redaction";
import {
  HEALTH_CHECK_DEFINITIONS,
  aggregateOverallStatus,
} from "@/lib/admin/system-health/system-health-registry";

function mockCheck(
  overrides: Partial<{
    id: string;
    criticality: "critical" | "normal";
    status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN" | "NOT_CONFIGURED";
  }>
) {
  const def = HEALTH_CHECK_DEFINITIONS.find((c) => c.id === overrides.id) ?? HEALTH_CHECK_DEFINITIONS[0]!;
  return {
    id: overrides.id ?? def.id,
    label: def.label,
    category: def.category,
    criticality: overrides.criticality ?? def.criticality,
    status: overrides.status ?? "HEALTHY",
    summary: "test",
    durationMs: 1,
    checkedAt: new Date().toISOString(),
    details: {},
    suggestedAction: null,
    issues: [],
  };
}

describe("migration health", () => {
  it("unresolved failed migration → UNHEALTHY", () => {
    const eval_ = evaluateMigrationHealth(
      [{ migration_name: "20260101_fail", finished_at: null, rolled_back_at: null }],
      []
    );
    assert.equal(eval_.status, "UNHEALTHY");
    assert.equal(eval_.activeFailedCount, 1);
    assert.ok(isActiveFailedMigration({ migration_name: "x", finished_at: null, rolled_back_at: null }));
  });

  it("rolled-back historical migration → aktif failure değil", () => {
    const eval_ = evaluateMigrationHealth(
      [
        {
          migration_name: "20260101_old",
          finished_at: null,
          rolled_back_at: new Date("2025-01-01"),
        },
      ],
      []
    );
    assert.equal(eval_.status, "HEALTHY");
    assert.equal(eval_.activeFailedCount, 0);
    assert.equal(eval_.historicalRolledBackCount, 1);
  });

  it("pending migration → UNHEALTHY", () => {
    const eval_ = evaluateMigrationHealth(
      [{ migration_name: "20260101_ok", finished_at: new Date(), rolled_back_at: null }],
      ["20260201_pending"]
    );
    assert.equal(eval_.status, "UNHEALTHY");
    assert.equal(eval_.pendingCount, 1);
  });

  it("migration up to date → HEALTHY", () => {
    const eval_ = evaluateMigrationHealth(
      [{ migration_name: "20260101_ok", finished_at: new Date(), rolled_back_at: null }],
      []
    );
    assert.equal(eval_.status, "HEALTHY");
  });
});

describe("memory metrics", () => {
  it("heap limit metriği üretilir", () => {
    const snapshot = captureMemorySnapshot();
    assert.ok(snapshot.heapUsedMb >= 0);
    assert.ok(snapshot.heapLimitMb > 0);
    assert.ok(snapshot.heapLimitUsageRatio >= 0);
  });

  it("development yüksek heap limit oranı kalıcı leak sayılmaz", () => {
    const eval_ = evaluateMemoryHealth(
      {
        heapUsedMb: 900,
        heapTotalMb: 950,
        heapLimitMb: 1000,
        rssMb: 1200,
        heapLimitUsageRatio: 0.95,
      },
      false
    );
    assert.equal(eval_.status, "HEALTHY");
  });

  it("production yüksek heap limit oranı DEGRADED", () => {
    const eval_ = evaluateMemoryHealth(
      {
        heapUsedMb: 900,
        heapTotalMb: 950,
        heapLimitMb: 1000,
        rssMb: 1200,
        heapLimitUsageRatio: 0.95,
      },
      true
    );
    assert.equal(eval_.status, "DEGRADED");
    assert.ok(eval_.issues.includes("HIGH_MEMORY_USAGE"));
  });
});

describe("health detail format", () => {
  it("nested object render", () => {
    const lines = formatHealthDetailsLines({
      memory: { heapUsedMb: 42, heapLimitMb: 512 },
    });
    assert.ok(lines.some((l) => l.includes("memory.heapUsedMb: 42")));
    assert.ok(lines.some((l) => l.includes("memory.heapLimitMb: 512")));
    assert.ok(!lines.some((l) => l.includes("[nesne]")));
  });

  it("array render", () => {
    const lines = formatHealthDetailEntry("registeredCronRoutes", ["/api/cron/a", "/api/cron/b"]);
    assert.ok(lines[0]?.includes("/api/cron/a"));
    assert.ok(lines[0]?.includes("/api/cron/b"));
  });

  it("null ve boolean format", () => {
    assert.equal(formatHealthDetailScalar(null), "—");
    assert.equal(formatHealthDetailScalar(true), "Evet");
    assert.equal(formatHealthDetailScalar(false), "Hayır");
  });
});

describe("health redaction", () => {
  it("safe boolean/count redakte edilmez", () => {
    const out = redactHealthDetails({
      configured: true,
      cronSecretConfigured: false,
      callbackRouteExists: true,
      callbackVerificationFailures24h: 2,
      waitingCallbackCount: 1,
      missing: ["SMTP_HOST"],
      invalid: [],
      failedCount: 0,
      stuckPendingCount: 0,
    }) as Record<string, unknown>;
    assert.equal(out.configured, true);
    assert.equal(out.cronSecretConfigured, false);
    assert.equal(out.callbackRouteExists, true);
    assert.equal(out.callbackVerificationFailures24h, 2);
    assert.deepEqual(out.missing, ["SMTP_HOST"]);
  });

  it("gerçek secret redakte edilir", () => {
    const out = redactHealthDetails({
      merchantKey: "secret-key",
      password: "p",
      authorization: "Bearer x",
      credentialsEncrypted: "enc",
    }) as Record<string, unknown>;
    assert.equal(out.merchantKey, "[REDACTED]");
    assert.equal(out.password, "[REDACTED]");
    assert.equal(out.authorization, "[REDACTED]");
    assert.equal(out.credentialsEncrypted, "[REDACTED]");
  });
});

describe("billing outbox stuck", () => {
  const stuckAfterMs = JOB_REGISTRY.find((j) => j.key === "billing-outbox")!.overdueAfterMs;
  const now = new Date("2026-06-21T12:00:00.000Z");

  it("yeni pending outbox stuck sayılmaz", () => {
    const count = countStuckOutboxPending(
      [{ availableAt: new Date("2026-06-21T11:50:00.000Z") }],
      now,
      stuckAfterMs
    );
    assert.equal(count, 0);
  });

  it("eski pending outbox stuck sayılır", () => {
    const count = countStuckOutboxPending(
      [{ availableAt: new Date("2026-06-21T10:00:00.000Z") }],
      now,
      stuckAfterMs
    );
    assert.equal(count, 1);
  });
});

describe("cron classification", () => {
  const jobs = JOB_REGISTRY.map((job) => ({
    key: job.key,
    cronRoute: job.cronRoute,
    overdueAfterMs: job.overdueAfterMs,
  }));

  it("development cron scheduler yok → NOT_CONFIGURED", () => {
    const result = evaluateCronHealth({
      cronSecretConfigured: false,
      isProduction: false,
      jobs,
      lastSuccessByKey: new Map(),
    });
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.issues.length, 0);
  });

  it("production CRON_SECRET yok → DEGRADED", () => {
    const result = evaluateCronHealth({
      cronSecretConfigured: false,
      isProduction: true,
      jobs,
      lastSuccessByKey: new Map(),
    });
    assert.equal(result.status, "DEGRADED");
  });

  it("production overdue cron → DEGRADED + CRON_OVERDUE", () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const lastSuccessByKey = new Map<string, Date | null>([
      ["billing-outbox", old],
    ]);
    const result = evaluateCronHealth({
      cronSecretConfigured: true,
      isProduction: true,
      jobs,
      lastSuccessByKey,
      exchangeRateStale: true,
    });
    assert.equal(result.status, "DEGRADED");
    assert.ok(result.issues.includes("CRON_OVERDUE"));
    assert.ok((result.details.overdueJobCount as number) > 0);
  });
});

describe("overall status aggregation (faz 16.1)", () => {
  it("yalnız NOT_CONFIGURED overall UNHEALTHY yapmaz", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "HEALTHY" }),
      mockCheck({ id: "paytr-config", status: "NOT_CONFIGURED" }),
      mockCheck({ id: "billing-outbox", status: "HEALTHY" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });

  it("kritik UNKNOWN tek başına UNHEALTHY yapmaz", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "UNKNOWN" }),
      mockCheck({ id: "database-migrations", status: "HEALTHY" }),
      mockCheck({ id: "prisma-client", status: "HEALTHY" }),
      mockCheck({ id: "paytr-config", status: "HEALTHY" }),
      mockCheck({ id: "billing-outbox", status: "HEALTHY" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });

  it("kritik olmayan UNHEALTHY → DEGRADED", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "HEALTHY" }),
      mockCheck({ id: "app-runtime", status: "UNHEALTHY", criticality: "normal" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });

  it("inactive integration NOT_CONFIGURED overall etkisi", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "HEALTHY" }),
      mockCheck({ id: "database-migrations", status: "HEALTHY" }),
      mockCheck({ id: "prisma-client", status: "HEALTHY" }),
      mockCheck({ id: "paytr-config", status: "HEALTHY" }),
      mockCheck({ id: "billing-outbox", status: "HEALTHY" }),
      mockCheck({ id: "marketplace-integrations", status: "NOT_CONFIGURED", criticality: "normal" }),
      mockCheck({ id: "efaturam-integrations", status: "NOT_CONFIGURED", criticality: "normal" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "HEALTHY");
  });

  it("inactive integration error sayılmaz", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/admin/system-health/system-health-checks.ts"),
      "utf8"
    );
    assert.ok(src.includes('where: { ...activeWhere, status: "ERROR" }'));
    assert.ok(src.includes("syncEnabled: true"));
  });
});
