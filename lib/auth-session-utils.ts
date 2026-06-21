import type { NextResponse } from "next/server";
import { signSessionToken } from "@/lib/auth/jwt";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
} from "@/lib/auth/auth-cookie";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
};

export { getAuthCookieOptions };

export function attachAuthCookie(
  response: NextResponse,
  payload: AuthTokenPayload
) {
  const token = signSessionToken(payload);
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}
