import { redactSystemLogRecursive } from "@/lib/admin/system-logs/system-log-privacy";

export function redactJobMetadata(value: unknown): unknown {
  return redactSystemLogRecursive(value);
}

export function buildSafeJobSummary(result: unknown): {
  summary: string;
  safeMetadata: Record<string, unknown>;
} {
  const safeMetadata = (
    result != null && typeof result === "object" && !Array.isArray(result)
      ? (redactJobMetadata(result) as Record<string, unknown>)
      : {}
  ) as Record<string, unknown>;

  if (result == null) {
    return { summary: "Tamamlandı", safeMetadata: {} };
  }

  if (typeof result === "object" && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of [
      "processed",
      "checked",
      "charged",
      "success",
      "failed",
      "total",
      "skipped",
      "unknown",
      "suspended",
      "cleaned",
      "reset",
    ]) {
      if (typeof obj[key] === "number") {
        parts.push(`${key}=${obj[key]}`);
      }
    }
    if (parts.length) {
      return { summary: parts.join(", "), safeMetadata };
    }
  }

  const text = typeof result === "string" ? result : "Tamamlandı";
  return { summary: text.slice(0, 300), safeMetadata };
}

export function sanitizeJobErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Job başarısız";
  const redacted = redactJobMetadata({ message }) as { message?: string };
  return (redacted.message ?? message).slice(0, 500);
}
