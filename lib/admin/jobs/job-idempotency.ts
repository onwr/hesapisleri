import { randomUUID } from "node:crypto";
import type { SystemJobRunTrigger } from "@prisma/client";
import { AdminJobServiceError } from "@/lib/admin/jobs/job-errors";

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export function resolveJobIdempotencyKey(input: {
  jobKey: string;
  trigger: SystemJobRunTrigger;
  userId?: string;
  provided?: string;
}): string | undefined {
  if (input.provided) return input.provided;
  if (input.trigger === "MANUAL" && input.userId) {
    return `manual:${input.jobKey}:${input.userId}:${randomUUID()}`;
  }
  return undefined;
}

export function assertIdempotencyJobMatch(
  existingJobKey: string,
  requestedJobKey: string,
  idempotencyKey: string
) {
  if (existingJobKey !== requestedJobKey) {
    throw new AdminJobServiceError(
      `Idempotency key başka bir job için kullanılmış: ${idempotencyKey}`,
      409,
      "IDEMPOTENCY_KEY_CONFLICT"
    );
  }
}
