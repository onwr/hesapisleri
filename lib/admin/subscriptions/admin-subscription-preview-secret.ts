/**
 * SUBSCRIPTION_PREVIEW_SECRET — separate from NEXTAUTH_SECRET.
 * Never sent to client, logged, or included in API responses.
 */

export const PREVIEW_SECRET_ERROR_CODE = "PREVIEW_SECRET_NOT_CONFIGURED";

export class PreviewSecretNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = PREVIEW_SECRET_ERROR_CODE;

  constructor(message = "Plan önizleme servisi yapılandırılmamış.") {
    super(message);
    this.name = "PreviewSecretNotConfiguredError";
  }
}

export class PreviewSecretConflictError extends Error {
  readonly status = 500;

  constructor() {
    super("SUBSCRIPTION_PREVIEW_SECRET, NEXTAUTH_SECRET ile aynı olamaz.");
    this.name = "PreviewSecretConflictError";
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Resolves preview HMAC secret.
 * - Production: SUBSCRIPTION_PREVIEW_SECRET required (min 16 chars), no fallback.
 * - Test: fixed test-only secret (not hardcoded in app runtime paths).
 * - Development: SUBSCRIPTION_PREVIEW_SECRET required; returns 503 if missing.
 */
export function resolveSubscriptionPreviewSecret(): string {
  const secret = process.env.SUBSCRIPTION_PREVIEW_SECRET?.trim();
  const authSecret = process.env.NEXTAUTH_SECRET?.trim();

  if (secret && authSecret && secret === authSecret) {
    throw new PreviewSecretConflictError();
  }

  if (isTest()) {
    return secret && secret.length >= 16 ? secret : "test-subscription-preview-secret-min16";
  }

  if (!secret || secret.length < 16) {
    throw new PreviewSecretNotConfiguredError(
      isProduction()
        ? "Plan önizleme servisi yapılandırılmamış."
        : "Geliştirme ortamında SUBSCRIPTION_PREVIEW_SECRET (min 16 karakter) tanımlanmalıdır."
    );
  }

  return secret;
}
