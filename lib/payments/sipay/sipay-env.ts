import { z } from "zod";
import {
  getActiveBillingProvider as resolveActiveBillingProvider,
  isSipayEnabled as checkSipayEnabled,
} from "../billing-provider-resolver";

export const SIPAY_ALLOWED_BASE_URLS = [
  "https://provisioning.sipay.com.tr",
  "https://app.sipay.com.tr",
] as const;

const BCRYPT_MERCHANT_KEY_PREFIX = "$2y$10$";
const BCRYPT_MERCHANT_KEY_MIN_LENGTH = 60;

function isValidBillingCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const billingCallbackUrlSchema = z
  .string()
  .min(1)
  .refine(isValidBillingCallbackUrl, {
    message:
      "Billing callback URL must be https:// or http://localhost (or 127.0.0.1)",
  });

const sipayEnvSchema = z.object({
  SIPAY_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SIPAY_ENV: z.enum(["test", "live"]).default("test"),
  SIPAY_APP_ID: z.string().min(1, "SIPAY_APP_ID required"),
  SIPAY_APP_SECRET: z.string().min(1, "SIPAY_APP_SECRET required"),
  SIPAY_MERCHANT_KEY: z.string().min(32, "SIPAY_MERCHANT_KEY must be ≥32 chars"),
  SIPAY_MERCHANT_ID: z.string().min(1, "SIPAY_MERCHANT_ID required"),
  SIPAY_SALE_WEBHOOK_KEY: z.string().optional().default(""),
  SIPAY_BASE_URL: z
    .string()
    .url()
    .refine((url) => SIPAY_ALLOWED_BASE_URLS.some((allowed) => url.startsWith(allowed)), {
      message: `SIPAY_BASE_URL must be one of: ${SIPAY_ALLOWED_BASE_URLS.join(", ")}`,
    })
    .optional(),
  SIPAY_RETURN_URL: billingCallbackUrlSchema,
  SIPAY_CANCEL_URL: billingCallbackUrlSchema,
});

export type SipayEnv = z.infer<typeof sipayEnvSchema>;

export type SipayMerchantKeyMetadata = {
  present: boolean;
  length: number;
  bcryptPrefix: boolean;
};

let _cached: SipayEnv | null = null;

export function getSipayMerchantKeyMetadata(
  raw: string | null | undefined = process.env.SIPAY_MERCHANT_KEY,
): SipayMerchantKeyMetadata {
  const key = raw?.trim() ?? "";
  return {
    present: key.length > 0,
    length: key.length,
    bcryptPrefix: key.startsWith(BCRYPT_MERCHANT_KEY_PREFIX),
  };
}

function assertMerchantKeyIntegrity(key: string) {
  if (!key.startsWith("$")) return;

  if (!key.startsWith(BCRYPT_MERCHANT_KEY_PREFIX)) {
    throw new Error(
      "SIPAY_MERCHANT_KEY $2y$10$ prefix bekleniyor — Next.js env expansion bozulmuş olabilir",
    );
  }

  if (key.length < BCRYPT_MERCHANT_KEY_MIN_LENGTH) {
    throw new Error(
      "SIPAY_MERCHANT_KEY uzunluğu geçersiz — env değeri eksik/bozuk olabilir",
    );
  }
}

export function getSipayEnv(): SipayEnv {
  if (_cached) return _cached;
  const result = sipayEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Sipay env config invalid:\n${result.error.message}`);
  }
  assertMerchantKeyIntegrity(result.data.SIPAY_MERCHANT_KEY);
  _cached = result.data;
  return _cached;
}

export function getSipayBaseUrl(env: Pick<SipayEnv, "SIPAY_ENV" | "SIPAY_BASE_URL">): string {
  if (env.SIPAY_BASE_URL) return env.SIPAY_BASE_URL;
  return env.SIPAY_ENV === "live"
    ? "https://app.sipay.com.tr"
    : "https://provisioning.sipay.com.tr";
}

export function validateReturnUrl(url: string): void {
  const allowed = SIPAY_ALLOWED_BASE_URLS.some((base) => url.startsWith(base));
  if (!allowed) {
    throw new Error(`Return URL host not in Sipay allowlist: ${url}`);
  }
}

// Reset for tests
export function _resetSipayEnvCache(): void {
  _cached = null;
}

// ─── Provider seçimi (billing-provider-resolver) ─────────────────────────────
export {
  type BillingPaymentProviderName,
  getActiveBillingProvider,
  isSipayEnabled,
  isPaytrEnabled,
  isSipayCheckoutActive,
  isPaytrCheckoutActive,
  validateBillingProviderConfig,
  getCheckoutProviderForClient,
} from "../billing-provider-resolver";

/** @deprecated use isSipayCheckoutActive */
export function isSipayActive(): boolean {
  return resolveActiveBillingProvider() === "SIPAY" && checkSipayEnabled();
}
