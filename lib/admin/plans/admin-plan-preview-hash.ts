/**
 * Server-side HMAC for plan price publish preview.
 */
import crypto from "crypto";

export const PLAN_PRICE_PREVIEW_TTL_MS = 15 * 60 * 1000;

export type AffectedSubscriptionSummary = {
  activeTotal: number;
  withPriceLock: number;
  withoutPriceLock: number;
  nextRenewalPlanned: number;
  grandfathered: number;
  pendingPlanChanges: number;
};

export interface PlanPricePreviewCanonicalPayload {
  planId: string;
  currentPriceId: string | null;
  billingInterval: string;
  currency: string;
  listPriceMinor: number;
  salePriceMinor: number;
  vatRate: number;
  vatIncluded: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  priceChangePolicy: string;
  isPublic: boolean;
  affectedSubscriptionSummary: AffectedSubscriptionSummary;
  issuedAt: number;
  expiresAt: number;
}

export class PreviewSecretNotConfiguredError extends Error {
  status = 503;
  code = "PREVIEW_SECRET_NOT_CONFIGURED";
  constructor() {
    super("PLAN_PRICE_PREVIEW_SECRET yapılandırılmamış.");
    this.name = "PreviewSecretNotConfiguredError";
  }
}

export class PreviewStaleError extends Error {
  status = 409;
  code = "PREVIEW_STALE";
  constructor() {
    super("Önizleme güncel değil; lütfen yeniden önizleyin.");
    this.name = "PreviewStaleError";
  }
}

export function getPlanPricePreviewSecret(): string {
  const secret = process.env.PLAN_PRICE_PREVIEW_SECRET;
  if (!secret || secret.length < 16) {
    throw new PreviewSecretNotConfiguredError();
  }
  const nextAuth = process.env.NEXTAUTH_SECRET;
  const subPreview = process.env.SUBSCRIPTION_PREVIEW_SECRET;
  if (secret === nextAuth || secret === subPreview) {
    throw new PreviewSecretNotConfiguredError();
  }
  return secret;
}

export function signPlanPricePreview(
  payload: PlanPricePreviewCanonicalPayload,
  secret: string,
  now = Date.now()
): string {
  const expiresAt = payload.expiresAt || now + PLAN_PRICE_PREVIEW_TTL_MS;
  const signed: PlanPricePreviewCanonicalPayload = {
    ...payload,
    issuedAt: payload.issuedAt || now,
    expiresAt,
  };
  const contentHash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(signed))
    .digest("hex");
  return `${contentHash}.${expiresAt}`;
}

export function verifyPlanPricePreview(
  token: string,
  expected: PlanPricePreviewCanonicalPayload,
  secret: string,
  now = Date.now()
): { valid: boolean; expired: boolean; tampered: boolean } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, expired: false, tampered: true };

  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt < now) {
    return { valid: false, expired: true, tampered: false };
  }

  const signed: PlanPricePreviewCanonicalPayload = {
    ...expected,
    expiresAt,
    issuedAt: expected.issuedAt || expiresAt - PLAN_PRICE_PREVIEW_TTL_MS,
  };

  const freshHash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(signed))
    .digest("hex");

  const tampered = freshHash !== parts[0];
  return { valid: !tampered, expired: false, tampered };
}
