import type { NextResponse } from "next/server";
import { getSessionMaxAgeDays } from "@/lib/admin/platform-settings";
import { signSessionToken } from "@/lib/auth/jwt";
import {
  AUTH_COOKIE_NAME,
  BROWSER_SESSION_JWT_DAYS,
  getAuthCookieOptions,
  getBrowserSessionAuthCookieOptions,
} from "@/lib/auth/auth-cookie";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
  sv: number;
};

export { getAuthCookieOptions, getBrowserSessionAuthCookieOptions };

export async function attachAuthCookie(
  response: NextResponse,
  payload: AuthTokenPayload,
  options?: { remember?: boolean }
) {
  if (options?.remember) {
    const sessionMaxAgeDays = await getSessionMaxAgeDays();
    const token = signSessionToken(payload, sessionMaxAgeDays);
    response.cookies.set(
      AUTH_COOKIE_NAME,
      token,
      getAuthCookieOptions(sessionMaxAgeDays)
    );
    return;
  }

  const token = signSessionToken(payload, BROWSER_SESSION_JWT_DAYS);
  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    getBrowserSessionAuthCookieOptions()
  );
}
