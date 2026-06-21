export const PARTNER_REF_COOKIE = "partner_ref";
export const PARTNER_CLICK_COOKIE = "partner_click_id";

export function getPartnerCookieMaxAge(days: number) {
  return days * 24 * 60 * 60;
}

export function buildReferralUrl(code: string, baseUrl?: string) {
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://hesapisleri.com";
  return `${origin.replace(/\/$/, "")}/r/${encodeURIComponent(code)}`;
}
