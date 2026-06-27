import type { Prisma, SystemJobRun, SystemJobRunTrigger } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminJobServiceError } from "@/lib/admin/jobs/job-errors";
import {
  assertIdempotencyJobMatch,
  isPrismaUniqueConstraintError,
} from "@/lib/admin/jobs/job-idempotency";
import { MANUAL_RUN_COOLDOWN_MS } from "@/lib/admin/jobs/job-types";

export type JobRunTx = Prisma.TransactionClient;

/**
 * Manuel cooldown: aynı jobKey için son MANUAL run'un createdAt zamanına bakılır.
 * SUCCEEDED, FAILED, TIMED_OUT veya hâlâ RUNNING olsun — 30 sn dolmadan yeni manuel
 * tetikleme reddedilir (JOB_COOLDOWN_ACTIVE). Process restart'tan etkilenmez.
 */
export async function assertManualRunCooldown(
  jobKey: string,
  tx: JobRunTx,
  cooldownMs = MANUAL_RUN_COOLDOWN_MS
) {
  const lastManual = await tx.systemJobRun.findFirst({
    where: { jobKey, trigger: "MANUAL" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!lastManual) return;

  const elapsed = Date.now() - lastManual.createdAt.getTime();
  if (elapsed < cooldownMs) {
    throw new AdminJobServiceError(
      "Manuel çalıştırma cooldown süresinde.",
      429,
      "JOB_COOLDOWN_ACTIVE"
    );
  }
}

export async function resolveStaleRunningRuns(
  jobKey: string,
  timeoutMs: number,
  tx: JobRunTx
) {
  const staleBefore = new Date(Date.now() - timeoutMs);
  await tx.systemJobRun.updateMany({
    where: {
      jobKey,
      status: "RUNNING",
      startedAt: { lt: staleBefore },
    },
    data: {
      status: "TIMED_OUT",
      finishedAt: new Date(),
      errorCode: "JOB_TIMEOUT_STALE",
      summary: "Zaman aşımı (stale running).",
    },
  });
}

async function acquireJobAdvisoryLock(jobKey: string, tx: JobRunTx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${jobKey}))`;
}

async function resolveIdempotencyInTx(
  jobKey: string,
  idempotencyKey: string | undefined,
  tx: JobRunTx
) {
  if (!idempotencyKey) return null;

  const existing = await tx.systemJobRun.findUnique({
    where: { idempotencyKey },
  });

  if (!existing) return null;

  assertIdempotencyJobMatch(existing.jobKey, jobKey, idempotencyKey);
  return existing;
}

export type ClaimJobRunInput = {
  jobKey: string;
  trigger: SystemJobRunTrigger;
  triggeredByUserId?: string;
  idempotencyKey?: string;
  timeoutMs: number;
};

export type ClaimJobRunResult =
  | { run: SystemJobRun; duplicate: false }
  | { run: SystemJobRun; duplicate: true };

export async function claimSystemJobRun(
  input: ClaimJobRunInput
): Promise<ClaimJobRunResult> {
  return db.$transaction(async (tx) => {
    await acquireJobAdvisoryLock(input.jobKey, tx);
    await resolveStaleRunningRuns(input.jobKey, input.timeoutMs, tx);

    const duplicate = await resolveIdempotencyInTx(
      input.jobKey,
      input.idempotencyKey,
      tx
    );
    if (duplicate) {
      return { run: duplicate, duplicate: true as const };
    }

    if (input.trigger === "MANUAL") {
      await assertManualRunCooldown(input.jobKey, tx);
    }

    const active = await tx.systemJobRun.findFirst({
      where: { jobKey: input.jobKey, status: "RUNNING" },
    });
    if (active) {
      throw new AdminJobServiceError("Job zaten çalışıyor.", 409, "JOB_ALREADY_RUNNING");
    }

    try {
      const run = await tx.systemJobRun.create({
        data: {
          jobKey: input.jobKey,
          status: "RUNNING",
          trigger: input.trigger,
          triggeredByUserId: input.triggeredByUserId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          startedAt: new Date(),
        },
      });
      return { run, duplicate: false as const };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error) && input.idempotencyKey) {
        const existing = await tx.systemJobRun.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) {
          assertIdempotencyJobMatch(existing.jobKey, input.jobKey, input.idempotencyKey);
          return { run: existing, duplicate: true as const };
        }
      }
      throw error;
    }
  });
}

export async function finalizeJobRunRecord(
  runId: string,
  data: Prisma.SystemJobRunUpdateInput
): Promise<SystemJobRun> {
  const result = await db.systemJobRun.updateMany({
    where: { id: runId, status: "RUNNING" },
    data,
  });

  if (result.count === 0) {
    const current = await db.systemJobRun.findUnique({ where: { id: runId } });
    if (current) return current;
    throw new AdminJobServiceError("Run kaydı güncellenemedi.", 409, "JOB_RUN_NOT_ACTIVE");
  }

  const updated = await db.systemJobRun.findUnique({ where: { id: runId } });
  if (!updated) {
    throw new Error("Run kaydı bulunamadı.");
  }
  return updated;
}
