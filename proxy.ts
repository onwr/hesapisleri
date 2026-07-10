import { NextResponse, type NextRequest } from "next/server";
import {
  createCsrfOriginRejectedResponse,
  normalizeApiPathname,
  shouldRejectUntrustedMutation,
} from "@/lib/api-origin-guard";
import { AUTH_COOKIE_NAME } from "@/lib/auth/auth-cookie";
import {
  buildSessionExpiredLoginUrl,
  createAuthRedirectDestination,
} from "@/lib/auth/auth-redirect";
import {
  isAuthApiRoute,
  isAuthRoute,
  isProtectedRoute,
} from "@/lib/auth/auth-routes";
import { verifySessionToken } from "@/lib/auth/jwt";

function getTokenFromRequest(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

// NOT: Bu fonksiyon yalnızca JWT imzası ve exp kontrolü yapar.
// sessionVersion (session revocation) kontrolü Edge runtime'da yapılamaz;
// bu kontrol lib/auth/auth-dal.ts içindeki resolveAuthState'de DB'ye erişilerek yapılır.
// Middleware yalnızca anonim kullanıcıları /login'e yönlendirmek içindir.
function isValidSessionToken(token: string | null) {
  if (!token) {
    return false;
  }

  return Boolean(verifySessionToken(token)?.userId);
}

function redirectTo(request: NextRequest, destination: string, reason?: string) {
  const target = createAuthRedirectDestination({
    requestUrl: request.url,
    destination,
    reason,
  });

  if (!target) {
    return NextResponse.next();
  }

  return NextResponse.redirect(target);
}

function withPathnameHeader(response: NextResponse, pathname: string) {
  response.headers.set("x-pathname", pathname);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) {
    return withPathnameHeader(NextResponse.next(), pathname);
  }

  if (
    pathname.startsWith("/api/") &&
    shouldRejectUntrustedMutation({
      method: request.method,
      pathname: normalizeApiPathname(pathname),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      authorization: request.headers.get("authorization"),
    })
  ) {
    return withPathnameHeader(createCsrfOriginRejectedResponse(), pathname);
  }

  if (isAuthApiRoute(pathname)) {
    return withPathnameHeader(NextResponse.next(), pathname);
  }

  const token = getTokenFromRequest(request);
  const hasValidToken = isValidSessionToken(token);

  if (isProtectedRoute(pathname)) {
    if (!hasValidToken) {
      if (token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        loginUrl.searchParams.set("reason", "session-expired");
        return withPathnameHeader(NextResponse.redirect(loginUrl), pathname);
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return withPathnameHeader(NextResponse.redirect(loginUrl), pathname);
    }

    return withPathnameHeader(NextResponse.next(), pathname);
  }

  if (isAuthRoute(pathname) && hasValidToken) {
    return withPathnameHeader(NextResponse.next(), pathname);
  }

  return withPathnameHeader(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
