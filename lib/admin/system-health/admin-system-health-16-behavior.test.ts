/**
 * Faz 16 — Sistem sağlığı davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  HEALTH_CHECK_DEFINITIONS,
  HEALTH_CHECK_IDS,
  aggregateOverallStatus,
  assertNoArbitraryHealthRunInput,
  assertValidHealthCheckId,
  probeEnvFields,
  redactHealthDetails,
  runCacheProbe,
} from "@/lib/admin/system-health";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

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

describe("registry check IDs", () => {
  it("tüm tanımlı check ID benzersiz", () => {
    assert.equal(HEALTH_CHECK_DEFINITIONS.length, HEALTH_CHECK_IDS.size);
    assert.ok(HEALTH_CHECK_IDS.has("database-connection"));
    assert.ok(HEALTH_CHECK_IDS.has("paytr-config"));
    assert.ok(HEALTH_CHECK_IDS.has("billing-outbox"));
  });

  it("kategori kapsamı", () => {
    const categories = new Set(HEALTH_CHECK_DEFINITIONS.map((c) => c.category));
    assert.ok(categories.has("database"));
    assert.ok(categories.has("payment"));
    assert.ok(categories.has("integrations"));
    assert.ok(categories.has("cron"));
  });
});

describe("overall status aggregation", () => {
  it("kritik UNHEALTHY genel UNHEALTHY", () => {
    const checks = [
      mockCheck({ id: "app-runtime", status: "HEALTHY" }),
      mockCheck({ id: "database-connection", status: "UNHEALTHY" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "UNHEALTHY");
  });

  it("kritik DEGRADED genel DEGRADED", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "DEGRADED" }),
      mockCheck({ id: "app-runtime", status: "HEALTHY" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });

  it("kritik olmayan UNHEALTHY → genel DEGRADED", () => {
    const checks = [
      mockCheck({ id: "database-connection", status: "HEALTHY", criticality: "critical" }),
      mockCheck({ id: "app-runtime", status: "UNHEALTHY", criticality: "normal" }),
    ];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });

  it("yalnız normal check UNHEALTHY → DEGRADED", () => {
    const checks = [mockCheck({ id: "app-runtime", status: "UNHEALTHY", criticality: "normal" })];
    assert.equal(aggregateOverallStatus(checks), "DEGRADED");
  });
});

describe("timeout ve izolasyon", () => {
  it("Promise.allSettled kullanımı", () => {
    const src = readSrc("lib/admin/system-health/system-health-service.ts");
    assert.ok(src.includes("Promise.allSettled"));
  });

  it("check timeout", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("CHECK_TIMEOUT_MS"));
    assert.ok(src.includes("withTimeout"));
  });

  it("bir check hata verince servis devam eder", () => {
    const src = readSrc("lib/admin/system-health/system-health-service.ts");
    assert.ok(src.includes('status === "fulfilled"'));
    assert.ok(src.includes("UNKNOWN"));
  });
});

describe("env configured/missing", () => {
  it("probeEnvFields missing", () => {
    const old = process.env.HEALTH_TEST_MISSING_XYZ;
    delete process.env.HEALTH_TEST_MISSING_XYZ;
    const r = probeEnvFields([{ key: "HEALTH_TEST_MISSING_XYZ", required: true }]);
    assert.equal(r.configured, false);
    assert.deepEqual(r.missing, ["HEALTH_TEST_MISSING_XYZ"]);
    if (old) process.env.HEALTH_TEST_MISSING_XYZ = old;
  });
});

describe("secret redaction", () => {
  it("payment credential response redaction", () => {
    const out = redactHealthDetails({
      merchantKey: "secret-key",
      merchantSalt: "salt",
      configured: true,
    }) as Record<string, unknown>;
    assert.equal(out.merchantKey, "[REDACTED]");
    assert.equal(out.merchantSalt, "[REDACTED]");
    assert.equal(out.configured, true);
  });

  it("integration credential redaction", () => {
    const out = redactHealthDetails({
      credentialsEncrypted: "enc-data",
      apiKey: "k",
    }) as Record<string, unknown>;
    assert.equal(out.credentialsEncrypted, "[REDACTED]");
    assert.equal(out.apiKey, "[REDACTED]");
  });

  it("cronSecretConfigured redakte edilmez", () => {
    const out = redactHealthDetails({
      cronSecretConfigured: true,
      registeredCronRoutes: ["/api/cron/billing-outbox"],
    }) as Record<string, unknown>;
    assert.equal(out.cronSecretConfigured, true);
    assert.deepEqual(out.registeredCronRoutes, ["/api/cron/billing-outbox"]);
  });
});

describe("cache NOT_CONFIGURED", () => {
  it("platform cache probe", () => {
    const probe = runCacheProbe();
    assert.equal(probe.ok, true);
    assert.ok(probe.backend.includes("in-memory"));
  });

  it("redis env NOT_CONFIGURED davranışı", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("AI_RATE_LIMIT_REDIS_URL"));
    assert.ok(src.includes("NOT_CONFIGURED"));
  });
});

describe("mail NOT_CONFIGURED", () => {
  it("mail provider check", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("MAIL_NOT_CONFIGURED"));
    assert.ok(!src.includes("sendMail"));
  });
});

describe("outbox ve cron issue kodları", () => {
  it("billing outbox issue kodları", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("OUTBOX_FAILED"));
    assert.ok(src.includes("OUTBOX_STUCK"));
  });

  it("billing outbox job registry stuck eşiği", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("getJobDefinition(\"billing-outbox\")"));
    assert.ok(src.includes("countStuckOutboxPending"));
    assert.ok(src.includes("/admin/jobs/billing-outbox"));
  });

  it("cron job registry kullanımı", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("JOB_REGISTRY"));
    assert.ok(src.includes("evaluateCronHealth"));
    assert.ok(!src.includes("26 * 60 * 60 * 1000"));
  });
});

describe("unknown checkId ve arbitrary input", () => {
  it("unknown checkId reddi", () => {
    assert.throws(() => assertValidHealthCheckId("evil-check"));
  });

  it("arbitrary command reddi", () => {
    assert.throws(() => assertNoArbitraryHealthRunInput({ command: "rm -rf /" }));
    assert.throws(() => assertNoArbitraryHealthRunInput({ url: "http://evil" }));
    assert.throws(() => assertNoArbitraryHealthRunInput({ shell: "ls" }));
  });

  it("boş body kabul", () => {
    assert.doesNotThrow(() => assertNoArbitraryHealthRunInput({}));
  });
});

describe("cache ve cooldown", () => {
  it("health cache TTL", () => {
    const src = readSrc("lib/admin/system-health/system-health-cache.ts");
    assert.ok(src.includes("CACHE_TTL_MS"));
    assert.ok(src.includes("RUN_COOLDOWN_MS"));
  });

  it("manuel refresh yalnız health cache", () => {
    const src = readSrc("lib/admin/system-health/system-health-service.ts");
    assert.ok(src.includes("invalidateHealthCache"));
    assert.ok(!src.includes("revalidateTag"));
  });
});

describe("auth ve mutation yok", () => {
  it("route requireSuperAdminApi", () => {
    assert.match(readRoute(["admin", "system-health"]), /requireSuperAdminApi/);
    assert.match(readRoute(["admin", "system-health", "checks"]), /requireSuperAdminApi/);
    assert.match(readRoute(["admin", "system-health", "checks", "[checkId]", "run"]), /requireSuperAdminApi/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("update/delete endpointi yok", () => {
    const root = readRoute(["admin", "system-health"]);
    assert.match(root, /405/);
    assert.ok(!root.includes("activityLog.update"));
  });
});

describe("database latency sınıflandırması", () => {
  it("DATABASE_SLOW eşikleri", () => {
    const src = readSrc("lib/admin/system-health/system-health-checks.ts");
    assert.ok(src.includes("DATABASE_SLOW"));
    assert.ok(src.includes("DATABASE_UNREACHABLE"));
    assert.ok(src.includes("latencyMs > 500"));
    assert.ok(src.includes("latencyMs > 2000"));
  });
});
