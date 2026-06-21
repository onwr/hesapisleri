import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Çıkış yapıldı.",
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", getClearAuthCookieOptions());

  return response;
}
