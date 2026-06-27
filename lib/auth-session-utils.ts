import type { NextResponse } from "next/server";
import { getSessionMaxAgeDays } from "@/lib/admin/platform-settings";
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
  sv: number;
};

export { getAuthCookieOptions };

export async function attachAuthCookie(
  response: NextResponse,
  payload: AuthTokenPayload
) {
  const sessionMaxAgeDays = await getSessionMaxAgeDays();
  const token = signSessionToken(payload, sessionMaxAgeDays);
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions(sessionMaxAgeDays));
}
