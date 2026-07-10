export const AUTH_COOKIE_NAME = "hesapisleri_token";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/** Tarayıcı oturumu (kapatılınca silinir) için JWT süresi üst sınırı. */
export const BROWSER_SESSION_JWT_DAYS = 1;

export function isAuthCookieSecure() {
  return process.env.NODE_ENV === "production";
}

export function getAuthCookieOptions(maxAgeDays = 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isAuthCookieSecure(),
    path: "/",
    maxAge: maxAgeDays * ONE_DAY_SECONDS,
  };
}

export function getBrowserSessionAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isAuthCookieSecure(),
    path: "/",
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
