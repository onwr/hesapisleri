/**
 * Faz 17 — Cron / job yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  JOB_REGISTRY,
  MANUAL_RUN_COOLDOWN_MS,
  assertJobDefinition,
  assertNoForbiddenJobRunKeys,
  adminJobRunBodySchema,
  buildSafeJobSummary,
  getJobDefinition,
  parseJobListFilters,
  redactJobMetadata,
} from "@/lib/admin/jobs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

const CRON_ROUTES = [
  "billing-outbox",
  "billing-renewals",
  "payment-reconciliation",
  "exchange-rates",
  "notifications",
  "employee-performance",
  "marketplace-sync",
  "membership-campaign-lifecycle",
  "discount-reservations",
  "usage-period-reset",
];

describe("registry gerçek job'lar", () => {
  it("10 cron route job kayıtlı", () => {
    assert.equal(JOB_REGISTRY.length, 10);
    for (const key of CRON_ROUTES) {
      assert.ok(getJobDefinition(key), `missing ${key}`);
    }
  });

  it("HTTP self-call yok", () => {
    const src = readSrc("lib/admin/jobs/job-run-service.ts");
    assert.ok(!src.includes("fetch("));
    assert.ok(!src.includes("/api/cron/"));
  });

  it("handler domain servisleri", () => {
    const src = readSrc("lib/admin/jobs/job-registry.ts");
    assert.ok(src.includes("processBillingOutboxBatch"));
    assert.ok(src.includes("runMarketplaceSyncCron"));
    assert.ok(!src.includes("child_process"));
  });
});

describe("manual unsupported", () => {
  it("billing-renewals manuel kapalı", () => {
    const job = getJobDefinition("billing-renewals");
    assert.equal(job?.manualRunSupported, false);
  });

  it("payment-reconciliation manuel kapalı", () => {
    assert.equal(getJobDefinition("payment-reconciliation")?.manualRunSupported, false);
  });

  it("billing-outbox manuel açık", () => {
    assert.equal(getJobDefinition("billing-outbox")?.manualRunSupported, true);
  });
});

describe("reason/confirm zorunlu", () => {
  it("adminJobRunBodySchema", () => {
    assert.equal(
      adminJobRunBodySchema.safeParse({ reason: "test", confirm: true }).success,
      true
    );
    assert.equal(adminJobRunBodySchema.safeParse({ reason: "test" }).success, false);
  });
});

describe("concurrency ve idempotency", () => {
  it("JOB_ALREADY_RUNNING", () => {
    const src = readSrc("lib/admin/jobs/job-run-claim.ts");
    assert.ok(src.includes("JOB_ALREADY_RUNNING"));
    assert.ok(src.includes('status: "RUNNING"'));
  });

  it("idempotencyKey unique", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("idempotencyKey") && schema.includes("@unique"));
  });

  it("stale RUNNING TIMED_OUT", () => {
    const src = readSrc("lib/admin/jobs/job-run-claim.ts");
    assert.ok(src.includes("JOB_TIMEOUT_STALE"));
    assert.ok(src.includes("resolveStaleRunningRuns"));
  });

  it("cooldown", () => {
    assert.equal(MANUAL_RUN_COOLDOWN_MS, 30_000);
    const src = readSrc("lib/admin/jobs/job-run-claim.ts");
    assert.ok(src.includes("JOB_COOLDOWN_ACTIVE"));
    assert.ok(src.includes("assertManualRunCooldown"));
  });
});

describe("redaction", () => {
  it("metadata secret redaction", () => {
    const out = redactJobMetadata({ password: "x", merchantKey: "k", processed: 5 }) as Record<
      string,
      unknown
    >;
    assert.equal(out.password, "[REDACTED]");
    assert.equal(out.merchantKey, "[REDACTED]");
    assert.equal(out.processed, 5);
  });

  it("safe summary", () => {
    const r = buildSafeJobSummary({ processed: 3, failed: 1 });
    assert.ok(r.summary.includes("processed=3"));
  });
});

describe("CRON_SECRET client'a çıkmaz", () => {
  it("admin run route secret döndürmez", () => {
    const src = readRoute(["admin", "jobs", "[jobKey]", "run"]);
    assert.ok(!src.includes("CRON_SECRET"));
  });

  it("cron route auth korunur", () => {
    const src = readRoute(["cron", "billing-outbox"]);
    assert.ok(src.includes("CRON_SECRET"));
    assert.ok(src.includes("runCronJob"));
  });
});

describe("arbitrary input reddi", () => {
  it("forbidden keys", () => {
    assert.throws(() => assertNoForbiddenJobRunKeys({ command: "ls" }));
    assert.throws(() => assertNoForbiddenJobRunKeys({ url: "http://x" }));
    assert.throws(() => assertNoForbiddenJobRunKeys({ handler: "x" }));
  });
});

describe("unknown job reddi", () => {
  it("assertJobDefinition", () => {
    assert.throws(() => assertJobDefinition("not-a-real-job"));
  });
});

describe("structured audit", () => {
  it("SystemJob entity scope", () => {
    const audit = readSrc("lib/admin/jobs/job-audit-service.ts");
    assert.ok(audit.includes('entityType: "SystemJob"'));
    assert.ok(audit.includes("jobKey"));
    const run = readSrc("lib/admin/jobs/job-run-service.ts");
    assert.ok(run.includes("SYSTEM_JOB_MANUAL_RUN"));
    assert.ok(run.includes("logAdminJobAudit"));
  });
});

describe("cache invalidation", () => {
  it("run sonrası cache temizler", () => {
    const src = readSrc("lib/admin/jobs/job-cache.ts");
    assert.ok(src.includes("admin-jobs"));
    assert.ok(src.includes("invalidateHealthCache"));
    assert.ok(src.includes("admin-overview"));
  });
});

describe("pagination/filter", () => {
  it("parseJobListFilters", () => {
    const f = parseJobListFilters({ q: "bill", category: "billing", pageSize: "50" });
    assert.equal(f.q, "bill");
    assert.equal(f.category, "billing");
    assert.equal(f.pageSize, 50);
  });
});

describe("auth", () => {
  it("admin jobs requireSuperAdminApi", () => {
    assert.match(readRoute(["admin", "jobs"]), /requireSuperAdminApi/);
    assert.match(readRoute(["admin", "jobs", "[jobKey]", "run"]), /requireSuperAdminApi/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("update/delete yok", () => {
    const src = readRoute(["admin", "jobs"]);
    assert.match(src, /405/);
  });
});

describe("SystemJobRun migration", () => {
  it("schema alanları", () => {
    const schema = readSrc("prisma/schema.prisma");
    assert.ok(schema.includes("model SystemJobRun"));
    assert.ok(schema.includes("enum SystemJobRunStatus"));
    assert.ok(schema.includes("enum SystemJobRunTrigger"));
    assert.ok(schema.includes("@@index([jobKey, startedAt])"));
  });
});

describe("timeout handling", () => {
  it("JOB_TIMEOUT", () => {
    const src = readSrc("lib/admin/jobs/job-run-service.ts");
    assert.ok(src.includes("TIMED_OUT"));
    assert.ok(src.includes("withJobTimeout"));
  });
});
