import { REDACTED_PLACEHOLDER } from "@/lib/admin/system-logs/system-log-privacy";

const HEALTH_SAFE_DETAIL_KEYS = new Set([
  "configured",
  "cronsecretconfigured",
  "callbackrouteexists",
  "callbackverificationfailures24h",
  "waitingcallbackcount",
  "configuredcompanycount",
  "connectedcount",
  "stalesynccount",
  "registeredcronroutes",
  "missing",
  "invalid",
  "failedcount",
  "stuckpendingcount",
  "historicalrolledbackcount",
  "activefailedcount",
  "pendingcount",
  "appliedcount",
  "errorcount",
  "orphanpaidpayments",
  "orphanactivesubscriptions",
  "pendingpendingsample",
  "pendingsample",
  "probeok",
  "clientresponsive",
  "poolerconfigured",
  "accelerateconfigured",
  "uploadconfigured",
  "tokenconfigured",
  "baseurlreachable",
  "testmode",
  "exchangeratestale",
  "billingoutboxfailed",
  "overduejobcount",
  "overduejobs",
  "lastprocessedat",
  "lastprocessedtype",
  "lastsuccessfulpaymentat",
  "lastfailedpaymentat",
  "latestmigration",
  "environment",
  "isproductionruntime",
  "schedulerexpected",
  "stuckafterms",
  "links",
]);

const HEALTH_SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^authorization$/i,
  /^cookie$/i,
  /merchant[_-]?key$/i,
  /merchant[_-]?salt$/i,
  /api[_-]?key$/i,
  /credentialsencrypted$/i,
  /credential$/i,
  /^salt$/i,
  /^key$/i,
  /uploadtoken$/i,
  /authtoken$/i,
  /sessiontoken$/i,
  /^token$/i,
  /^secret$/i,
  /hmac/i,
  /rawbody/i,
  /rawpayload/i,
  /^iban$/i,
];

function isHealthSafeKey(key: string) {
  return HEALTH_SAFE_DETAIL_KEYS.has(key.toLowerCase());
}

function isHealthSensitiveKey(key: string) {
  if (isHealthSafeKey(key)) return false;
  return HEALTH_SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactHealthValue(key: string, value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";

  if (isHealthSensitiveKey(key)) {
    return REDACTED_PLACEHOLDER;
  }

  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      typeof item === "object" && item != null
        ? redactHealthDetails(item as Record<string, unknown>, depth + 1)
        : redactHealthValue(`${key}[${index}]`, item, depth + 1)
    );
  }

  if (typeof value === "object") {
    return redactHealthDetails(value as Record<string, unknown>, depth + 1);
  }

  if (typeof value === "string" && isHealthSensitiveKey(key)) {
    return REDACTED_PLACEHOLDER;
  }

  return value;
}

export function redactHealthDetails(
  details: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    out[key] = redactHealthValue(key, value, depth);
  }
  return out;
}
