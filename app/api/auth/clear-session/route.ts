import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";
import { sanitizeAuthRedirectPath } from "@/lib/auth/auth-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = sanitizeAuthRedirectPath(url.searchParams.get("next"), {
    fallback: "/login",
  });

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(AUTH_COOKIE_NAME, "", getClearAuthCookieOptions());

  return response;
}
