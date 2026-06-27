import { z } from "zod";
import { HEALTH_CHECK_IDS } from "@/lib/admin/system-health/system-health-registry";

export const systemHealthRunBodySchema = z.object({}).strict();

export function assertValidHealthCheckId(checkId: string): void {
  if (!HEALTH_CHECK_IDS.has(checkId)) {
    throw new Error("Bilinmeyen health check.");
  }
}

export function assertNoArbitraryHealthRunInput(body: unknown): void {
  if (body == null) return;
  if (typeof body !== "object") {
    throw new Error("Geçersiz istek gövdesi.");
  }
  const record = body as Record<string, unknown>;
  const forbidden = ["command", "url", "host", "shell", "query", "sql", "script"];
  for (const key of forbidden) {
    if (key in record) {
      throw new Error(`"${key}" kabul edilmez.`);
    }
  }
  systemHealthRunBodySchema.parse(body);
}
