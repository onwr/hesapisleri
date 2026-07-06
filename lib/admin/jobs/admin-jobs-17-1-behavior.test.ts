/**
 * Faz 17.1 — DB cooldown, atomik claim, idempotency, cron response
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SystemJobRun } from "@prisma/client";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import {
  AdminJobServiceError,
  assertIdempotencyJobMatch,
  buildCronRouteResponse,
  claimSystemJobRun,
  finalizeJobRunRecord,
  resolveJobIdempotencyKey,
} from "@/lib/admin/jobs";
import { db } from "@/lib/prisma";

const TEST_PREFIX = "__test_job_17_1_";
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// TEST_DATABASE_URL yoksa gerçek DB testleri KONTROLLÜ skip edilir.
const dbTestOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: "TEST_DATABASE_URL tanımlı değil — gerçek DB entegrasyon testi atlandı." };

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

async function cleanupTestRuns() {
  await db.systemJobRun.deleteMany({
    where: { jobKey: { startsWith: TEST_PREFIX } },
  });
}

function jobKey(suffix: string) {
  return `${TEST_PREFIX}${suffix}`;
}

function succeededRun(overrides: Partial<SystemJobRun> = {}): SystemJobRun {
  return {
    id: "run-1",
    jobKey: "notifications",
    status: "SUCCEEDED",
    trigger: "CRON",
    triggeredByUserId: null,
    idempotencyKey: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    durationMs: 10,
    summary: "ok",
    errorCode: null,
    safeMetadata: {
      created: 3,
      skipped: 1,
      companiesScanned: 2,
      items: [],
    },
    createdAt: new Date(),
    ...overrides,
  };
}

describe("process-memory cooldown yok", () => {
  it("lastManualRunAt Map kullanılmıyor", () => {
    const src = readSrc("lib/admin/jobs/job-run-service.ts");
    assert.ok(!src.includes("lastManualRunAt"));
    assert.ok(!src.includes("new Map"));
  });
});

describe("parameterized advisory lock", () => {
  it("pg_advisory_xact_lock hashtext", () => {
    const src = readSrc("lib/admin/jobs/job-run-claim.ts");
    assert.match(src, /pg_advisory_xact_lock\(hashtext/);
    assert.match(src, /\$executeRaw`/);
    assert.doesNotMatch(src, /\$\{input\.jobKey\}/);
  });
});

describe("DB claim davranışı", dbTestOptions, () => {
  after(async () => {
    await cleanupTestRuns();
  });

  it("iki eşzamanlı claim — yalnız biri RUNNING olur", async () => {
    const key = jobKey(`concurrent-${randomUUID()}`);
    const results = await Promise.allSettled([
      claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 60_000 }),
      claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 60_000 }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const ok = fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof claimSystemJobRun>>>;
    assert.equal(ok.value.duplicate, false);
    assert.equal(ok.value.run.status, "RUNNING");

    const fail = rejected[0] as PromiseRejectedResult;
    assert.ok(fail.reason instanceof AdminJobServiceError);
    assert.equal(fail.reason.code, "JOB_ALREADY_RUNNING");
  });

  it("ikinci istek aktif RUNNING görür", async () => {
    const key = jobKey(`running-${randomUUID()}`);
    const first = await claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 60_000 });

    await assert.rejects(
      () => claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 60_000 }),
      (error: unknown) =>
        error instanceof AdminJobServiceError && error.code === "JOB_ALREADY_RUNNING"
    );

    await finalizeJobRunRecord(first.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "done",
    });
  });

  it("DB cooldown — başarısız manuel run sonrası reddedilir", async () => {
    const key = jobKey(`cooldown-fail-${randomUUID()}`);
    const first = await claimSystemJobRun({
      jobKey: key,
      trigger: "MANUAL",
      timeoutMs: 60_000,
    });

    await finalizeJobRunRecord(first.run.id, {
      status: "FAILED",
      finishedAt: new Date(),
      summary: "failed",
      errorCode: "JOB_FAILED",
    });

    await assert.rejects(
      () =>
        claimSystemJobRun({
          jobKey: key,
          trigger: "MANUAL",
          timeoutMs: 60_000,
        }),
      (error: unknown) =>
        error instanceof AdminJobServiceError && error.code === "JOB_COOLDOWN_ACTIVE"
    );
  });

  it("CRON trigger manuel cooldown'dan etkilenmez", async () => {
    const key = jobKey(`cron-bypass-${randomUUID()}`);
    const manual = await claimSystemJobRun({
      jobKey: key,
      trigger: "MANUAL",
      timeoutMs: 60_000,
    });
    await finalizeJobRunRecord(manual.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "ok",
    });

    const cron = await claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 60_000 });
    assert.equal(cron.duplicate, false);
    await finalizeJobRunRecord(cron.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "cron ok",
    });
  });

  it("stale RUNNING TIMED_OUT sonra yeni run", async () => {
    const key = jobKey(`stale-${randomUUID()}`);
    const stale = await db.systemJobRun.create({
      data: {
        jobKey: key,
        status: "RUNNING",
        trigger: "CRON",
        startedAt: new Date(Date.now() - 120_000),
      },
    });

    const claimed = await claimSystemJobRun({ jobKey: key, trigger: "CRON", timeoutMs: 30_000 });
    assert.equal(claimed.duplicate, false);

    const refreshed = await db.systemJobRun.findUnique({ where: { id: stale.id } });
    assert.equal(refreshed?.status, "TIMED_OUT");
    assert.equal(refreshed?.errorCode, "JOB_TIMEOUT_STALE");

    await finalizeJobRunRecord(claimed.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "after stale",
    });
  });

  it("farklı jobKey birbirini kilitlemez", async () => {
    const keyA = jobKey(`iso-a-${randomUUID()}`);
    const keyB = jobKey(`iso-b-${randomUUID()}`);

    const a = await claimSystemJobRun({ jobKey: keyA, trigger: "CRON", timeoutMs: 60_000 });
    const b = await claimSystemJobRun({ jobKey: keyB, trigger: "CRON", timeoutMs: 60_000 });

    assert.equal(a.run.status, "RUNNING");
    assert.equal(b.run.status, "RUNNING");

    await finalizeJobRunRecord(a.run.id, { status: "SUCCEEDED", finishedAt: new Date() });
    await finalizeJobRunRecord(b.run.id, { status: "SUCCEEDED", finishedAt: new Date() });
  });

  it("duplicate idempotency key aynı run döner", async () => {
    const key = jobKey(`idem-${randomUUID()}`);
    const idem = `idem-key-${randomUUID()}`;

    const first = await claimSystemJobRun({
      jobKey: key,
      trigger: "CRON",
      idempotencyKey: idem,
      timeoutMs: 60_000,
    });
    await finalizeJobRunRecord(first.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "done",
    });

    const second = await claimSystemJobRun({
      jobKey: key,
      trigger: "CRON",
      idempotencyKey: idem,
      timeoutMs: 60_000,
    });

    assert.equal(second.duplicate, true);
    assert.equal(second.run.id, first.run.id);
  });

  it("aynı idempotency key farklı job conflict", async () => {
    const idem = `conflict-${randomUUID()}`;
    const keyA = jobKey(`conf-a-${randomUUID()}`);
    const keyB = jobKey(`conf-b-${randomUUID()}`);

    await claimSystemJobRun({
      jobKey: keyA,
      trigger: "CRON",
      idempotencyKey: idem,
      timeoutMs: 60_000,
    });

    await assert.rejects(
      () =>
        claimSystemJobRun({
          jobKey: keyB,
          trigger: "CRON",
          idempotencyKey: idem,
          timeoutMs: 60_000,
        }),
      (error: unknown) =>
        error instanceof AdminJobServiceError && error.code === "IDEMPOTENCY_KEY_CONFLICT"
    );
  });

  it("handler yalnız kendi run kaydını tamamlar", async () => {
    const keyA = jobKey(`fin-a-${randomUUID()}`);
    const keyB = jobKey(`fin-b-${randomUUID()}`);

    const runA = await claimSystemJobRun({ jobKey: keyA, trigger: "CRON", timeoutMs: 60_000 });
    const runB = await claimSystemJobRun({ jobKey: keyB, trigger: "CRON", timeoutMs: 60_000 });

    await finalizeJobRunRecord(runA.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "a done",
    });

    const stillB = await db.systemJobRun.findUnique({ where: { id: runB.run.id } });
    assert.equal(stillB?.status, "RUNNING");

    await finalizeJobRunRecord(runB.run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      summary: "b done",
    });
  });
});

describe("idempotency key üretimi", () => {
  it("boş key için server-generated değer", () => {
    const key = resolveJobIdempotencyKey({
      jobKey: "billing-outbox",
      trigger: "MANUAL",
      userId: "user-1",
    });
    assert.ok(key?.startsWith("manual:billing-outbox:user-1:"));
  });

  it("assertIdempotencyJobMatch conflict", () => {
    assert.throws(
      () => assertIdempotencyJobMatch("job-a", "job-b", "shared-key"),
      (error: unknown) =>
        error instanceof AdminJobServiceError && error.code === "IDEMPOTENCY_KEY_CONFLICT"
    );
  });
});

describe("cron response uyumluluğu", () => {
  it("notifications spread + legacy alanlar", () => {
    const body = buildCronRouteResponse("notifications", succeededRun()) as Record<
      string,
      unknown
    >;
    assert.equal(body.success, true);
    assert.equal(body.created, 3);
    assert.equal(body.companiesScanned, 2);
    assert.equal(body.runId, "run-1");
    assert.equal(body.status, "SUCCEEDED");
    assert.ok(Array.isArray(body.items));
  });

  it("billing-outbox nested data", () => {
    const body = buildCronRouteResponse(
      "billing-outbox",
      succeededRun({
        jobKey: "billing-outbox",
        safeMetadata: { processed: 4 },
      })
    );
    assert.equal(body.success, true);
    assert.deepEqual(body.data, { processed: 4 });
    assert.equal((body as { processed?: number }).processed, undefined);
  });

  it("exchange-rates windowKey ve rates korunur", () => {
    const body = buildCronRouteResponse(
      "exchange-rates",
      succeededRun({
        jobKey: "exchange-rates",
        safeMetadata: {
          windowKey: "2026-06-19-06",
          fetchedAt: "2026-06-19T06:00:00.000Z",
          source: "open.er-api.com",
          rates: { USD: 38.5, EUR: 44.1 },
        },
      })
    ) as Record<string, unknown>;
    assert.equal(body.windowKey, "2026-06-19-06");
    assert.ok(body.rates);
    assert.equal(body.source, "open.er-api.com");
  });

  it("marketplace-sync data.total ve data.success", () => {
    const body = buildCronRouteResponse(
      "marketplace-sync",
      succeededRun({
        jobKey: "marketplace-sync",
        safeMetadata: { total: 2, success: 1, failed: 1, items: [] },
      })
    );
    assert.equal(body.success, true);
    assert.equal(body.data.total, 2);
    assert.equal(body.data.success, 1);
  });
});

describe("CRON_SECRET response'a çıkmaz", () => {
  it("buildCronRouteResponse secret içermez", () => {
    const body = buildCronRouteResponse(
      "billing-outbox",
      succeededRun({ safeMetadata: { processed: 1 } })
    );
    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /CRON_SECRET/);
  });
});

describe("tenant admin reddedilir", () => {
  it("isPlatformSuperAdminUser false for tenant ADMIN", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });
});
