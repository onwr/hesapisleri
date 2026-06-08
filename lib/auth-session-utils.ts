import type { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
};

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function attachAuthCookie(
  response: NextResponse,
  payload: AuthTokenPayload
) {
  const token = signToken(payload);
  response.cookies.set("hesapisleri_token", token, getAuthCookieOptions());
}
