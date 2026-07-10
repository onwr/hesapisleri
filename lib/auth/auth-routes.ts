export const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

export const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/partner",
  "/partnership",
  "/partner/apply",
  "/partnership/apply",
  "/kvkk-aydinlatma-metni",
  "/kvkk",
  "/privacy",
  "/maintenance",
] as const;

export const COMPANY_SELECTION_ROUTES = [
  "/companies/select",
  "/companies/new",
] as const;

/** Yalnız bilinen tenant/admin namespace'leri korunur; bilinmeyen path'ler public 404 olur. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/admin",
  "/pos",
  "/sales",
  "/customers",
  "/suppliers",
  "/directory",
  "/products",
  "/stocks",
  "/invoices",
  "/cash-bank",
  "/expenses",
  "/reports",
  "/ai-assistant",
  "/team",
  "/orders",
  "/settings",
  "/notifications",
  "/calendar",
  "/onboarding",
  "/invite",
  "/unauthorized",
  "/partnership/dashboard",
  "/partnership/status",
  "/partner/dashboard",
] as const;

const PUBLIC_PARTNER_PREFIXES = ["/partner", "/partnership"] as const;

const AUTH_API_PREFIX = "/api/auth/";

function normalizePathname(pathname: string) {
  if (!pathname) {
    return "/";
  }

  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }

  return withoutQuery;
}

function matchesRoute(pathname: string, route: string) {
  const normalized = normalizePathname(pathname);
  const normalizedRoute = normalizePathname(route);

  if (normalizedRoute === "/") {
    return normalized === "/";
  }

  return (
    normalized === normalizedRoute ||
    normalized.startsWith(`${normalizedRoute}/`)
  );
}

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => matchesRoute(pathname, route));
}

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route));
}

export function isCompanySelectionRoute(pathname: string) {
  return COMPANY_SELECTION_ROUTES.some((route) =>
    matchesRoute(pathname, route)
  );
}

export function isAuthApiRoute(pathname: string) {
  return pathname.startsWith(AUTH_API_PREFIX);
}

export function isProtectedRoute(pathname: string) {
  const normalized = normalizePathname(pathname);

  if (
    normalized.startsWith("/_next") ||
    normalized === "/favicon.ico" ||
    normalized === "/robots.txt" ||
    normalized === "/sitemap.xml"
  ) {
    return false;
  }

  if (isPublicRoute(normalized)) {
    return false;
  }

  if (isAuthRoute(normalized)) {
    return false;
  }

  if (isCompanySelectionRoute(normalized)) {
    return false;
  }

  if (normalized.startsWith("/api/")) {
    return false;
  }

  if (
    PUBLIC_PARTNER_PREFIXES.some(
      (prefix) =>
        normalized === prefix || normalized.startsWith(`${prefix}/apply`)
    )
  ) {
    return false;
  }

  if (
    normalized.startsWith("/companies/") &&
    !isCompanySelectionRoute(normalized)
  ) {
    return true;
  }

  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) =>
      normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}
