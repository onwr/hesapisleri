export const AUTH_COOKIE_NAME = "hesapisleri_token";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function isAuthCookieSecure() {
  return process.env.NODE_ENV === "production";
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isAuthCookieSecure(),
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  };
}

export function getClearAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isAuthCookieSecure(),
    path: "/",
    maxAge: 0,
  };
}
