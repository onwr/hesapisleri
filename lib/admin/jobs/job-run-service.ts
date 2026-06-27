import "server-only";

import type { Prisma, SystemJobRunTrigger } from "@prisma/client";
import { invalidateAdminJobCaches } from "@/lib/admin/jobs/job-cache";
import { logAdminJobAudit } from "@/lib/admin/jobs/job-audit-service";
import { AdminJobServiceError } from "@/lib/admin/jobs/job-errors";
import { buildSafeJobSummary, sanitizeJobErrorMessage } from "@/lib/admin/jobs/job-privacy";
import { assertJobDefinition } from "@/lib/admin/jobs/job-registry";
import {
  claimSystemJobRun,
  finalizeJobRunRecord,
} from "@/lib/admin/jobs/job-run-claim";

export { AdminJobServiceError } from "@/lib/admin/jobs/job-errors";

async function withJobTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("JOB_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function executeRegisteredJob(
  jobKey: string,
  input: {
    trigger: SystemJobRunTrigger;
    triggeredByUserId?: string;
    idempotencyKey?: string;
    reason?: string;
  }
) {
  const job = assertJobDefinition(jobKey);

  if (input.trigger === "MANUAL" && !job.manualRunSupported) {
    throw new AdminJobServiceError(
      "Bu job manuel çalıştırmayı desteklemiyor.",
      400,
      "MANUAL_RUN_NOT_SUPPORTED"
    );
  }

  const { run, duplicate } = await claimSystemJobRun({
    jobKey,
    trigger: input.trigger,
    triggeredByUserId: input.triggeredByUserId,
    idempotencyKey: input.idempotencyKey,
    timeoutMs: job.timeoutMs,
  });

  if (duplicate) {
    return run;
  }

  const started = run.startedAt?.getTime() ?? Date.now();

  try {
    const result = await withJobTimeout(job.handler(), job.timeoutMs);
    const { summary, safeMetadata } = buildSafeJobSummary(result);

    const updated = await finalizeJobRunRecord(run.id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      durationMs: Date.now() - started,
      summary,
      safeMetadata: safeMetadata as Prisma.InputJsonValue,
      errorCode: null,
    });

    if (input.trigger === "MANUAL" && input.triggeredByUserId) {
      await logAdminJobAudit({
        userId: input.triggeredByUserId,
        action: "SYSTEM_JOB_MANUAL_RUN",
        jobKey,
        displayMessage: `Job manuel çalıştırıldı: ${job.label}`,
        metadata: {
          reason: input.reason,
          runId: updated.id,
          status: updated.status,
          summary,
        },
      });
    }

    invalidateAdminJobCaches(jobKey);
    return updated;
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "JOB_TIMEOUT";
    const errorCode = isTimeout ? "JOB_TIMEOUT" : "JOB_FAILED";
    const status = isTimeout ? "TIMED_OUT" : "FAILED";
    const message = isTimeout ? "Job zaman aşımına uğradı." : sanitizeJobErrorMessage(error);

    const updated = await finalizeJobRunRecord(run.id, {
      status,
      finishedAt: new Date(),
      durationMs: Date.now() - started,
      summary: message,
      errorCode,
    });

    invalidateAdminJobCaches(jobKey);
    return updated;
  }
}

export async function runCronJob(jobKey: string) {
  return executeRegisteredJob(jobKey, { trigger: "CRON" });
}
