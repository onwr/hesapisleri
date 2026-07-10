import { AUTH_ROUTES } from "./auth-routes";

const BLOCKED_REDIRECT_PREFIXES = ["/api/auth/"];

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (trimmed.includes("://")) {
    return null;
  }

  return trimmed;
}

export function sanitizeAuthRedirectPath(
  value: string | null | undefined,
  options?: {
    currentPathname?: string;
    fallback?: string;
  }
): string {
  const fallback = options?.fallback ?? "/dashboard";

  if (!value) {
    return fallback;
  }

  const normalized = normalizePath(value);
  if (!normalized) {
    return fallback;
  }

  if (AUTH_ROUTES.some((route) => normalized === route || normalized.startsWith(`${route}?`))) {
    return fallback;
  }

  if (BLOCKED_REDIRECT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return fallback;
  }

  if (
    options?.currentPathname &&
    normalizePath(options.currentPathname) === normalized.split("?")[0]
  ) {
    return fallback;
  }

  return normalized;
}

export function buildSessionExpiredLoginUrl(
  nextPath = "/login?reason=session-expired"
) {
  const trimmed = nextPath.trim();
  const destination =
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("://")
      ? trimmed
      : "/login?reason=session-expired";

  return destination;
}

/** @deprecated GET clear-session kaldırıldı; doğrudan login URL kullanın. */
export function buildClearSessionUrl(nextPath: string) {
  return buildSessionExpiredLoginUrl(nextPath);
}

export function createAuthRedirectDestination(input: {
  requestUrl: string;
  destination: string;
  reason?: string;
}) {
  const current = new URL(input.requestUrl);
  const destination = new URL(input.destination, current);

  if (destination.pathname === current.pathname) {
    return null;
  }

  if (process.env.AUTH_REDIRECT_DEBUG === "true" && input.reason) {
    destination.searchParams.set("authReason", input.reason);
  }

  return destination;
}
