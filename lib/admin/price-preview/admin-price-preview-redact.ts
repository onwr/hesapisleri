const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "apiKey",
  "secret",
  "token",
  "providerCredential",
  "webhookSecret",
  "previewToken",
  "previewHash",
]);

export function redactPreviewPayload<T>(value: T): T {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPreviewPayload(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    out[key] = redactPreviewPayload(val);
  }
  return out as T;
}
