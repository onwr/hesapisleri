import { NextResponse } from "next/server";
import {
  PARTNER_CLICK_COOKIE,
  PARTNER_REF_COOKIE,
  getPartnerCookieMaxAge,
} from "@/lib/partner-cookie";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";
import { recordReferralClick } from "@/lib/partner-service";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { code } = await context.params;
  const url = new URL(req.url);
  const settings = await ensurePartnerSettings();

  const click = await recordReferralClick({
    referralCode: code,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
    referrer: req.headers.get("referer"),
    landingUrl: url.toString(),
    utmSource: url.searchParams.get("utm_source"),
    utmCampaign: url.searchParams.get("utm_campaign"),
  });

  const redirectUrl = new URL("/register", url.origin);
  redirectUrl.searchParams.set("ref", code.toUpperCase());

  const response = NextResponse.redirect(redirectUrl);

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
}
