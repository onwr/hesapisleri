import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/auth-cookie";
import {
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";

export {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  getClearAuthCookieOptions,
} from "@/lib/auth/auth-cookie";
export {
  decodeSessionToken,
  isSessionExpired,
  signSessionToken,
  verifySessionToken,
  type SessionTokenPayload,
} from "@/lib/auth/jwt";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export function signToken(payload: object) {
  return signSessionToken(payload as Parameters<typeof signSessionToken>[0]);
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  return verifySessionToken(token) as T | null;
}

export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}
