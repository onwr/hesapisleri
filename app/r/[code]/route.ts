import { NextResponse } from "next/server";
import {
  PARTNER_CLICK_COOKIE,
  PARTNER_REF_COOKIE,
  getPartnerCookieMaxAge,
} from "@/lib/partner-cookie";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { recordReferralClick } from "@/lib/partner-service";
import { sanitizeReferralCode } from "@/lib/partner-utils";

type RouteContext = {
  params: Promise<{ code: string }>;
};

function buildSafeRegisterRedirect(origin: string, code?: string | null) {
  const redirectUrl = new URL("/register", origin);
  const sanitized = code ? sanitizeReferralCode(code) : null;

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
    const redirectUrl = buildSafeRegisterRedirect(url.origin, sanitizedCode);
    const response = NextResponse.redirect(redirectUrl);

    if (!sanitizedCode) {
      return response;
    }

    const settings = await ensurePartnerSettings();
    const click = await recordReferralClick({
      referralCode: sanitizedCode,
      ip:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip"),
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
    return NextResponse.redirect(buildSafeRegisterRedirect(url.origin));
  }
}
