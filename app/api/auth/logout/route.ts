import { NextResponse } from "next/server";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import {
  AUTH_COOKIE_NAME,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";

export async function POST(request: Request) {
  const originError = verifyApiMutationOrigin(request);
  if (originError) {
    return originError;
  }

  const response = NextResponse.json({
    success: true,
    message: "Çıkış yapıldı.",
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", getClearAuthCookieOptions());

  return response;
}
