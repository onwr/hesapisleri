import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";

const SENSITIVE_METADATA_KEYS = new Set([
  "iban",
  "secret",
  "token",
  "apiKey",
  "password",
  "authorization",
]);

export function redactSettingsAuditValue(key: string, value: unknown): unknown {
  if (SENSITIVE_METADATA_KEYS.has(key)) return "[redacted]";
  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 120)}…`;
  }
  return redactValueRecursive(value);
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
