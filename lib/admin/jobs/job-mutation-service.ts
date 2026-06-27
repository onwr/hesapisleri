import "server-only";

import { executeRegisteredJob } from "@/lib/admin/jobs/job-run-service";
import {
  adminJobRunBodySchema,
  assertNoForbiddenJobRunKeys,
} from "@/lib/admin/jobs/job-schemas";
import { assertJobDefinition } from "@/lib/admin/jobs/job-registry";
import { AdminJobServiceError } from "@/lib/admin/jobs/job-errors";
import { resolveJobIdempotencyKey } from "@/lib/admin/jobs/job-idempotency";

export async function runAdminJobManual(
  jobKey: string,
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenJobRunKeys(body);
  assertJobDefinition(jobKey);
  const parsed = adminJobRunBodySchema.parse(body);

  const idempotencyKey = resolveJobIdempotencyKey({
    jobKey,
    trigger: "MANUAL",
    userId: actorUserId,
    provided: parsed.idempotencyKey,
  });

  const run = await executeRegisteredJob(jobKey, {
    trigger: "MANUAL",
    triggeredByUserId: actorUserId,
    idempotencyKey,
    reason: parsed.reason,
  });

  if (run.status === "FAILED" || run.status === "TIMED_OUT") {
    throw new AdminJobServiceError(
      run.summary ?? "Job başarısız.",
      500,
      run.errorCode ?? "JOB_FAILED"
    );
  }

  return run;
}
