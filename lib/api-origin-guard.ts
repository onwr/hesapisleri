import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const BEARER_ONLY_API_PREFIXES = ["/api/mobile"] as const;

export const MUTATION_ORIGIN_EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/cron/",
  "/api/billing/sipay/return",
  "/api/billing/sipay/cancel",
  "/api/payments/paytr/callback",
] as const;

export function isBearerOnlyApiPath(pathname: string) {
  const normalized = normalizeApiPathname(pathname);
  return BEARER_ONLY_API_PREFIXES.some((prefix) => {
    const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return normalized === base || normalized.startsWith(`${base}/`);
  });
}

export function isMutationOriginGuardDisabled() {
  return process.env.MUTATION_ORIGIN_GUARD_DISABLED === "true";
}

export function normalizeApiPathname(pathname: string) {
  if (!pathname) return "/";
  const withoutQuery = pathname.split("?")[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function isMutationOriginExemptPath(pathname: string) {
  const normalized = normalizeApiPathname(pathname);
  return MUTATION_ORIGIN_EXEMPT_PREFIXES.some((prefix) => {
    const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return normalized === base || normalized.startsWith(`${base}/`);
  });
}

export function isMutationHttpMethod(method: string) {
  return MUTATION_METHODS.has(method.toUpperCase());
}

export function getAllowedMutationOrigins() {
  const origins = new Set<string>();
  const isProduction = process.env.NODE_ENV === "production";

  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.WEBSITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.SIPAY_RETURN_URL,
    process.env.SIPAY_CANCEL_URL,
    process.env.PAYTR_OK_URL,
    process.env.PAYTR_FAIL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ...(isProduction
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"]),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      // ignore invalid env URL
    }
  }

  return [...origins];
}

export function isAllowedMutationOrigin(origin: string | null, referer: string | null) {
  const allowed = getAllowedMutationOrigins();

  if (origin) {
    return allowed.includes(origin);
  }

  if (referer) {
    try {
      return allowed.includes(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}

export function createCsrfOriginRejectedResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "İstek kaynağı doğrulanamadı.",
      code: "CSRF_ORIGIN_REJECTED",
    },
    { status: 403 }
  );
}

export function shouldRejectUntrustedMutation(input: {
  method: string;
  pathname: string;
  origin: string | null;
  referer: string | null;
  authorization: string | null;
}) {
  if (isMutationOriginGuardDisabled()) {
    return false;
  }

  if (!isMutationHttpMethod(input.method)) {
    return false;
  }

  if (isMutationOriginExemptPath(input.pathname)) {
    return false;
  }

  if (isBearerOnlyApiPath(input.pathname)) {
    return false;
  }

  if (getAllowedMutationOrigins().length === 0) {
    return true;
  }

  return !isAllowedMutationOrigin(input.origin, input.referer);
}

export function verifyApiMutationOrigin(req: Request) {
  const pathname = normalizeApiPathname(new URL(req.url).pathname);

  if (
    shouldRejectUntrustedMutation({
      method: req.method,
      pathname,
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      authorization: req.headers.get("authorization"),
    })
  ) {
    return createCsrfOriginRejectedResponse();
  }

  return null;
}

export function isCrossSiteNavigation(request: Pick<Request, "headers">) {
  const secFetchSite = request.headers.get("sec-fetch-site");
  return secFetchSite === "cross-site";
}
