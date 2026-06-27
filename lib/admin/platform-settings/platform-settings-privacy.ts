import { redactSystemLogRecursive } from "@/lib/admin/system-logs/system-log-privacy";

export function redactSettingsAuditValue(key: string, value: unknown): unknown {
  if (/secret|token|password|credential|apiKey|salt|merchant|database_url/i.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 120)}…`;
  }
  return redactSystemLogRecursive(value);
}

export function buildSafeSettingsDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (before[key] !== after[key]) {
      diff[key] = {
        from: redactSettingsAuditValue(key, before[key]),
        to: redactSettingsAuditValue(key, after[key]),
      };
    }
  }
  return diff;
}
