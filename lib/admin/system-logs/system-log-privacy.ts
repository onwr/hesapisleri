import { maskIp } from "@/lib/admin/plans/admin-plan-activity-scope";

export const REDACTED_PLACEHOLDER = "[REDACTED]";

const SENSITIVE_KEY_PATTERNS = [
  /previewtoken/i,
  /preview_secret/i,
  /plan_price_preview_secret/i,
  /subscription_preview_secret/i,
  /nextauth_secret/i,
  /^password$/i,
  /^authorization$/i,
  /^cookie$/i,
  /sessiontoken/i,
  /session/i,
  /api[_-]?key/i,
  /merchant[_-]?key/i,
  /merchant[_-]?salt/i,
  /credential/i,
  /secret/i,
  /hmac/i,
  /rawbody/i,
  /raw_body/i,
  /rawpayload/i,
  /raw_payload/i,
  /webhook/i,
  /callback/i,
  /providerresponse/i,
  /provider_response/i,
  /^iban$/i,
  /card/i,
  /pan/i,
  /payer/i,
  /cvv/i,
  /cvc/i,
  /token/i,
];

const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i;

export function isSensitiveSystemLogKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

function maskIbanValue(value: string): string {
  const cleaned = value.replace(/\s/g, "");
  if (cleaned.length <= 8) return "****";
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
}

function redactStringValue(value: string): string {
  const trimmed = value.trim();
  if (IBAN_PATTERN.test(trimmed.replace(/\s/g, ""))) {
    return maskIbanValue(trimmed);
  }
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(trimmed)) return REDACTED_PLACEHOLDER;
  }
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

export function redactSystemLogValue(key: string, value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";

  if (isSensitiveSystemLogKey(key)) {
    return REDACTED_PLACEHOLDER;
  }

  if (key === "ip" && typeof value === "string") {
    return maskIp(value);
  }

  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSystemLogRecursive(item, depth + 1));
  }

  if (typeof value === "object") {
    return redactSystemLogRecursive(value, depth + 1);
  }

  if (typeof value === "string") {
    return redactStringValue(value);
  }

  return value;
}

export function redactSystemLogRecursive(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSystemLogRecursive(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactSystemLogValue(k, v, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    return redactStringValue(value);
  }

  return value;
}

export function redactSystemLogMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null;
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return redactSystemLogRecursive(metadata) as Record<string, unknown>;
  }
  return null;
}

export function redactSystemLogMessage(message: string | null | undefined): string {
  if (!message?.trim()) return "";
  const redacted = redactStringValue(message);
  return redacted.length > 200 ? `${redacted.slice(0, 200)}…` : redacted;
}

export function maskEntityIdForExport(entityId: string | null | undefined): string {
  if (!entityId?.trim()) return "";
  if (entityId.length <= 12) return entityId;
  return `${entityId.slice(0, 6)}…${entityId.slice(-4)}`;
}
