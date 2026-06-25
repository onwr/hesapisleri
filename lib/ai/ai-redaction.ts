const SENSITIVE_KEY_PATTERN =
  /password|secret|token|apikey|api_key|authorization|iban|credential/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const API_KEY_PATTERN = /\b(sk-[a-zA-Z0-9_-]{10,})\b/g;

export function redactSensitiveText(input: string) {
  return input
    .replace(API_KEY_PATTERN, "[REDACTED_KEY]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
}

export function sanitizeToolOutput<T>(value: T): T {
  return redactSensitiveObject(value) as T;
}

function redactSensitiveObject(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactSensitiveText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitiveObject(item));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveObject(nested);
      }
    }
    return result;
  }
  return value;
}

export function serializeDecimalValue(value: unknown) {
  if (value === null || value === undefined) return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  if (typeof value === "object" && value !== null && "toString" in value) {
    const asString = String(value);
    const parsed = Number(asString);
    return Number.isFinite(parsed) ? parsed : asString;
  }
  return value;
}

export function serializeForAi<T>(value: T): T {
  return sanitizeToolOutput(deepSerializeDecimals(value)) as T;
}

function deepSerializeDecimals(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => deepSerializeDecimals(item));
  if (typeof value === "object") {
    if ("toNumber" in (value as object)) {
      return serializeDecimalValue(value);
    }
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = deepSerializeDecimals(nested);
    }
    return result;
  }
  return value;
}
