export const ONBOARDING_RETURN_TO_ALLOWLIST = [
  "/onboarding",
  "/dashboard",
  "/products",
  "/products/new",
  "/customers",
  "/customers/new",
  "/pos",
  "/sales/new",
  "/settings/integrations",
  "/team",
  "/stocks",
] as const;

export const ONBOARDING_EXEMPT_ROUTE_PREFIXES = [
  "/onboarding",
  "/login",
  "/logout",
  "/maintenance",
  "/companies/select",
  "/companies/new",
  "/admin",
  "/api/auth",
  "/api/cron",
  "/api/payments/paytr/callback",
  "/api/public",
] as const;

const BLOCKED_SCHEME_PATTERN = /^(javascript|data|vbscript):/i;

function normalizeReturnToCandidate(value: string) {
  let current = value.trim();

  for (let i = 0; i < 3; i += 1) {
    if (!current.includes("%")) break;
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return current.trim();
}

function isBlockedReturnTo(value: string) {
  if (!value) return true;
  if (BLOCKED_SCHEME_PATTERN.test(value)) return true;
  if (value.includes("://")) return true;
  if (value.startsWith("//")) return true;
  if (!value.startsWith("/")) return true;
  if (value.startsWith("/\\") || value.includes("\\")) return true;
  return false;
}

function isAllowlistedInternalPath(pathOnly: string) {
  return ONBOARDING_RETURN_TO_ALLOWLIST.some(
    (route) => pathOnly === route || pathOnly.startsWith(`${route}/`)
  );
}

/**
 * Güvenli internal returnTo çözümleyici.
 * Geçersiz değerlerde fallback döner.
 */
export function parseSafeInternalReturnTo(
  value: string | null | undefined,
  options?: { fallback?: string }
): string | null {
  const fallback = options?.fallback ?? null;
  if (!value) return fallback;

  const normalized = normalizeReturnToCandidate(value);
  if (isBlockedReturnTo(normalized)) {
    return fallback;
  }

  const pathOnly = normalized.split("?")[0]?.split("#")[0] ?? normalized;
  if (!isAllowlistedInternalPath(pathOnly)) {
    return fallback;
  }

  return normalized;
}

export function isOnboardingExemptPath(pathname: string): boolean {
  const normalized = pathname.split("?")[0] ?? pathname;
  return ONBOARDING_EXEMPT_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/** @deprecated parseSafeInternalReturnTo kullanın */
export function sanitizeOnboardingReturnTo(
  value: string | null | undefined,
  fallback = "/onboarding"
): string {
  return parseSafeInternalReturnTo(value, { fallback }) ?? fallback;
}

export function resolvePostCreateRedirect(input: {
  returnTo: string | null | undefined;
  defaultDestination: string;
}): string {
  return (
    parseSafeInternalReturnTo(input.returnTo, {
      fallback: input.defaultDestination,
    }) ?? input.defaultDestination
  );
}
