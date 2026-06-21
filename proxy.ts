import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/auth-cookie";
import {
  buildClearSessionUrl,
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (isAuthApiRoute(pathname)) {
    return NextResponse.next();
  }

  const token = getTokenFromRequest(request);
  const hasValidToken = isValidSessionToken(token);

  if (isProtectedRoute(pathname)) {
    if (!hasValidToken) {
      if (token) {
        return redirectTo(
          request,
          buildClearSessionUrl(
            `/login?next=${encodeURIComponent(pathname)}&reason=session-expired`
          ),
          "invalid-token"
        );
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  if (isAuthRoute(pathname) && hasValidToken) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
