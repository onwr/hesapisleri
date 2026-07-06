import { NextResponse } from "next/server";
import {
  PARTNER_CLICK_COOKIE,
  PARTNER_REF_COOKIE,
  getPartnerCookieMaxAge,
} from "@/lib/partner-cookie";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { recordReferralClick } from "@/lib/partner-service";
import { sanitizeReferralCode } from "@/lib/partner-utils";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

type RouteContext = {
  params: Promise<{ code: string }>;
};

/**
 * Referans linkine tıklayan kullanıcı oturum açıksa doğrudan /register'a
 * gönderilmez (zaten kayıtlı kullanıcı için anlamsız/kafa karıştırıcı) —
 * paket seçimi/checkout'un yapıldığı /settings/billing'e ?ref= korunarak
 * yönlendirilir. Oturum yoksa kayıt sayfasına gider.
 */
async function resolveReferralDestination(origin: string, code?: string | null) {
  const sanitized = code ? sanitizeReferralCode(code) : null;

  let isAuthenticated = false;
  try {
    const token = await getAuthToken();
    isAuthenticated = Boolean(token && verifyToken(token));
  } catch {
    isAuthenticated = false;
  }

  const redirectUrl = new URL(
    isAuthenticated ? "/settings/billing" : "/register",
    origin
  );

  if (sanitized) {
    redirectUrl.searchParams.set("ref", sanitized);
  }

  return redirectUrl;
}

export async function GET(req: Request, context: RouteContext) {
  const url = new URL(req.url);

  try {
    const { code } = await context.params;
    const sanitizedCode = sanitizeReferralCode(code);
    const redirectUrl = await resolveReferralDestination(url.origin, sanitizedCode);
    const response = NextResponse.redirect(redirectUrl);

    if (!sanitizedCode) {
      return response;
    }

    const settings = await ensurePartnerSettings();
    const click = await recordReferralClick({
      referralCode: sanitizedCode,
      ip: getTrustedClientIp(req),
      userAgent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
      landingUrl: url.toString(),
      utmSource: url.searchParams.get("utm_source"),
      utmCampaign: url.searchParams.get("utm_campaign"),
    });

    if (click) {
      const maxAge = getPartnerCookieMaxAge(settings.cookieDurationDays);
      response.cookies.set(PARTNER_REF_COOKIE, click.referralCode, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
      response.cookies.set(PARTNER_CLICK_COOKIE, click.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
    }

    return response;
  } catch (error) {
    console.error("PARTNER_REFERRAL_REDIRECT_ERROR", error);
    // Hata durumunda da açık internal detay sızdırılmaz — güvenli, kod'suz
    // fallback (register sayfası).
    return NextResponse.redirect(new URL("/register", url.origin));
  }
}
