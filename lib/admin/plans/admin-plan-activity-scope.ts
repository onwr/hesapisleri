import type { Prisma } from "@prisma/client";

export type ActivityLogScopeRow = {
  id: string;
  action: string;
  module: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

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
  /api[_-]?key/i,
  /credential/i,
  /secret/i,
  /hmac/i,
  /rawbody/i,
  /raw_body/i,
];

export function isSensitiveMetadataKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
}

export function redactValueRecursive(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactValueRecursive(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveMetadataKey(k)) {
        out[k] = "[redacted]";
        continue;
      }
      if (k === "ip" && typeof v === "string") {
        out[k] = maskIp(v);
        continue;
      }
      out[k] = redactValueRecursive(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      if (pattern.test(value)) return "[redacted]";
    }
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  return value;
}

export function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  if (ip.includes(":")) return `${ip.slice(0, 6)}…`;
  return "—";
}

export function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function metadataPlanId(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return typeof meta.planId === "string" ? meta.planId : null;
}

/** Structured scope: entityType/entityId veya metadata.planId */
export function matchesStructuredPlanScope(row: ActivityLogScopeRow, planId: string): boolean {
  if (row.module !== "admin-plans") return false;

  if (row.entityType === "MembershipPlan" && row.entityId === planId) return true;

  const meta = parseMetadata(row.metadata) ?? parseMetadata(row.message);
  const metaPlanId = metadataPlanId(meta);
  if (metaPlanId === planId) return true;

  if (
    row.entityType &&
    row.entityId &&
    metaPlanId === planId
  ) {
    return true;
  }

  return false;
}

/** Legacy fallback: yalnız exact JSON planId token */
export function matchesLegacyInferredPlanScope(row: ActivityLogScopeRow, planId: string): boolean {
  if (row.module !== "admin-plans") return false;
  if (matchesStructuredPlanScope(row, planId)) return false;
  if (!row.message) return false;

  const exactTokens = [
    `"planId":"${planId}"`,
    `"planId": "${planId}"`,
  ];
  if (!exactTokens.some((t) => row.message!.includes(t))) return false;

  const meta = parseMetadata(row.message);
  return metadataPlanId(meta) === planId;
}

export function belongsToPlanActivity(row: ActivityLogScopeRow, planId: string): boolean {
  return matchesStructuredPlanScope(row, planId) || matchesLegacyInferredPlanScope(row, planId);
}

export function filterLogsForPlan(rows: ActivityLogScopeRow[], planId: string) {
  return rows.filter((row) => belongsToPlanActivity(row, planId));
}

export function buildStructuredPlanActivityWhere(
  planId: string,
  module = "admin-plans"
): Prisma.ActivityLogWhereInput {
  return {
    module,
    OR: [
      { AND: [{ entityType: "MembershipPlan" }, { entityId: planId }] },
      { metadata: { path: ["planId"], equals: planId } },
    ],
  };
}

export function redactActivityForResponse(input: {
  message: string | null;
  metadata: unknown;
}): string {
  const meta = parseMetadata(input.metadata);
  if (meta) {
    const redacted = redactValueRecursive(meta);
    return JSON.stringify(redacted);
  }
  if (!input.message) return "";
  const legacyMeta = parseMetadata(input.message);
  if (legacyMeta) {
    return JSON.stringify(redactValueRecursive(legacyMeta));
  }
  return input.message.length > 500 ? `${input.message.slice(0, 500)}…` : input.message;
}
