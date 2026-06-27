function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

function matchesPrefix(pathname: string, prefix: string) {
  const normalized = normalizePathname(pathname);
  const normalizedPrefix = normalizePathname(prefix);
  return (
    normalized === normalizedPrefix ||
    normalized.startsWith(`${normalizedPrefix}/`)
  );
}

/** Sayfa route'ları — bakım modunda tenant erişimi engellenmez. */
export const MAINTENANCE_EXEMPT_PAGE_PREFIXES = [
  "/maintenance",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/admin",
  "/kvkk",
  "/kvkk-aydinlatma-metni",
] as const;

/** API route'ları — cron, callback ve auth bakımdan muaf. */
export const MAINTENANCE_EXEMPT_API_PREFIXES = [
  "/api/auth/",
  "/api/cron/",
  "/api/payments/paytr/callback",
  "/api/admin/",
  "/api/public/",
] as const;

export function isMaintenanceExemptPage(pathname: string) {
  const normalized = normalizePathname(pathname);

  if (
    normalized.startsWith("/_next") ||
    normalized === "/favicon.ico" ||
    normalized === "/robots.txt" ||
    normalized === "/sitemap.xml" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/.test(normalized)
  ) {
    return true;
  }

  return MAINTENANCE_EXEMPT_PAGE_PREFIXES.some((prefix) =>
    matchesPrefix(normalized, prefix)
  );
}

export function isMaintenanceExemptApi(pathname: string) {
  const normalized = normalizePathname(pathname);
  return MAINTENANCE_EXEMPT_API_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix)
  );
}
