const BLOCKED_PATH_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/api/",
  "/maintenance",
] as const;

const BLOCKED_PATH_PATTERNS = [
  /\/sipay/i,
  /^\/cash-bank\/transactions\/[^/]+\/edit(?:\/|$)/,
] as const;

const ENTITY_LIST_FALLBACKS: Array<{ prefix: string; fallback: string }> = [
  { prefix: "/sales/quotes/", fallback: "/sales?tab=offers" },
  { prefix: "/sales/", fallback: "/sales" },
  { prefix: "/invoices/", fallback: "/invoices" },
  { prefix: "/orders/", fallback: "/orders" },
  { prefix: "/expenses/", fallback: "/expenses" },
  { prefix: "/products/", fallback: "/products" },
  { prefix: "/customers/", fallback: "/customers" },
  { prefix: "/suppliers/", fallback: "/suppliers" },
  { prefix: "/team/payroll/", fallback: "/team/payroll" },
  { prefix: "/team/", fallback: "/team" },
  { prefix: "/cash-bank/transactions/", fallback: "/cash-bank" },
  { prefix: "/cash-bank/", fallback: "/cash-bank" },
];

export const DEFAULT_TENANT_ACTION_FALLBACK = "/notifications";

function splitPathAndQuery(actionUrl: string) {
  const hashIndex = actionUrl.indexOf("#");
  const withoutHash = hashIndex >= 0 ? actionUrl.slice(0, hashIndex) : actionUrl;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex >= 0) {
    return {
      path: withoutHash.slice(0, queryIndex),
      suffix: withoutHash.slice(queryIndex),
    };
  }
  return { path: withoutHash, suffix: "" };
}

function isBlockedTenantPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return true;
  if (/^https?:/i.test(path)) return true;
  if (/^javascript:/i.test(path)) return true;

  for (const prefix of BLOCKED_PATH_PREFIXES) {
    if (prefix.endsWith("/")) {
      if (path.startsWith(prefix)) return true;
      continue;
    }
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

export function resolveTenantListFallbackForDetailUrl(
  actionUrl: string,
  fallback: string = DEFAULT_TENANT_ACTION_FALLBACK,
) {
  const { path } = splitPathAndQuery(actionUrl.trim());
  for (const entry of ENTITY_LIST_FALLBACKS) {
    if (path.startsWith(entry.prefix)) {
      return entry.fallback;
    }
  }
  return fallback;
}

export function resolveSafeTenantActionUrl(
  actionUrl: string | null | undefined,
  options?: { fallback?: string },
): string | null {
  const fallback = options?.fallback ?? DEFAULT_TENANT_ACTION_FALLBACK;
  if (!actionUrl) return null;

  const trimmed = actionUrl.trim();
  if (!trimmed) return null;

  const { path, suffix } = splitPathAndQuery(trimmed);
  if (isBlockedTenantPath(path)) {
    return fallback;
  }

  return `${path}${suffix}`;
}

export function hasSafeTenantActionUrl(actionUrl: string | null | undefined) {
  return resolveSafeTenantActionUrl(actionUrl) !== null;
}
