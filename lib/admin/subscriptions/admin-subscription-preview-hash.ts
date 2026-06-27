/**
 * Server-side HMAC signing for plan-change previews.
 * Hash is server-generated only — client sends it back as an opaque token.
 */
import crypto from "crypto";

export const PREVIEW_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface PreviewCanonicalPayload {
  subscriptionId: string;
  companyId: string;
  currentPlanId: string;
  currentPlanPriceId: string;
  currentBillingInterval: string;
  targetPlanId: string;
  targetPlanPriceId: string;
  targetBillingInterval: string;
  currency: string;
  listPriceMinor: number;
  salePriceMinor: number;
  monthlyEquivalentMinor: number;
  discountSummary: string;
  couponId: string | null;
  campaignId: string | null;
  activeAddOnEffectMinor: number;
  effectiveMode: "IMMEDIATELY" | "NEXT_PERIOD";
  issuedAt: number;
  expiresAt: number;
}

/**
 * Sign a preview payload with HMAC-SHA256.
 * Returns `contentHash.expiresAtMs` — the `expiresAtMs` is NOT secret; the HMAC is.
 */
export function signPreviewHash(
  payload: PreviewCanonicalPayload,
  secret: string,
  now = Date.now()
): string {
  const expiresAt = payload.expiresAt || now + PREVIEW_TTL_MS;
  const signedPayload: PreviewCanonicalPayload = {
    ...payload,
    issuedAt: payload.issuedAt || now,
    expiresAt,
  };
  const contentHash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(signedPayload))
    .digest("hex");
  return `${contentHash}.${expiresAt}`;
}

/**
 * Verify a preview hash token.
 * Checks both expiry and HMAC integrity against a freshly-derived canonical payload.
 */
export function verifyPreviewHash(
  token: string,
  freshPayload: PreviewCanonicalPayload,
  secret: string,
  now = Date.now()
): { valid: boolean; expired: boolean; tampered: boolean } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, expired: false, tampered: true };

  const [storedHash, expiresAtStr] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || now > expiresAt) {
    return { valid: false, expired: true, tampered: false };
  }

  const payloadWithTiming: PreviewCanonicalPayload = {
    ...freshPayload,
    issuedAt: freshPayload.issuedAt || expiresAt - PREVIEW_TTL_MS,
    expiresAt,
  };

  const freshHash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payloadWithTiming))
    .digest("hex");

  const tampered = freshHash !== storedHash;
  return { valid: !tampered, expired: false, tampered };
}
