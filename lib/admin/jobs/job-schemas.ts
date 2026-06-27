import { z } from "zod";

export const adminJobRunBodySchema = z
  .object({
    reason: z.string().min(1).max(2000),
    confirm: z.literal(true),
    idempotencyKey: z.string().min(8).max(120).optional(),
  })
  .strict();

const forbiddenKeys = ["handler", "url", "command", "shell", "jobKey", "sql", "script"] as const;

export function assertNoForbiddenJobRunKeys(body: Record<string, unknown>) {
  for (const key of forbiddenKeys) {
    if (key in body) {
      throw new Error(`"${key}" kabul edilmez.`);
    }
  }
}
