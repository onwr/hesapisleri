import { z } from "zod";
import {
  getActiveBillingProvider as resolveActiveBillingProvider,
  isSipayEnabled as checkSipayEnabled,
} from "../billing-provider-resolver";

/** Sipay-hosted redirect/checkout origin allowlist (domain root). */
export const SIPAY_ALLOWED_ORIGINS = [
  "https://provisioning.sipay.com.tr",
  "https://app.sipay.com.tr",
] as const;

/** @deprecated use SIPAY_ALLOWED_ORIGINS */
export const SIPAY_ALLOWED_BASE_URLS = SIPAY_ALLOWED_ORIGINS;

export const SIPAY_TEST_API_BASE = "https://provisioning.sipay.com.tr/ccpayment";
export const SIPAY_LIVE_API_BASE = "https://app.sipay.com.tr/ccpayment";

/** Sipay dokümantasyonundaki sandbox merchant key — canlıda kullanılamaz. */
export const SIPAY_SANDBOX_MERCHANT_KEY =
  "$2y$10$HmRgYosneqcwHj.UH7upGuyCZqpQ1ITgSMj9Vvxn.t6f.Vdf2SQFO";

const BCRYPT_MERCHANT_KEY_PREFIX = "$2y$10$";
const BCRYPT_MERCHANT_KEY_EXACT_LENGTH = 60;

const CANONICAL_SIPAY_ENV = ["test", "live"] as const;
export type CanonicalSipayEnv = (typeof CANONICAL_SIPAY_ENV)[number];

export function normalizeSipayEnvName(raw: unknown): CanonicalSipayEnv {
  const value = String(raw ?? "test").trim().toLowerCase();
  if (value === "live" || value === "production" || value === "prod") return "live";
  if (value === "test" || value === "sandbox") return "test";
  throw new Error(`SIPAY_ENV geçersiz: ${String(raw)} — yalnızca test veya live kabul edilir.`);
}

export function normalizeSipayBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  for (const origin of SIPAY_ALLOWED_ORIGINS) {
    if (trimmed === origin) return `${origin}/ccpayment`;
    if (trimmed === `${origin}/ccpayment`) return `${origin}/ccpayment`;
  }
  throw new Error(
    `SIPAY_BASE_URL geçersiz: ${raw} — izin verilen kökler: ${SIPAY_ALLOWED_ORIGINS.join(", ")}`,
  );
}

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

/** Raw env string — içerideki $ karakterlerine dokunulmaz. */
function readRawEnvString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Yalnızca dış boşluk/satır sonu temizlenir; bcrypt gövdesi korunur. */
export function normalizeMerchantKey(value: unknown): string {
  const raw = readRawEnvString(value);
  return raw.replace(/^\s+/, "").replace(/\s+$/, "");
}

/** dotenv-expand: $$ → $ */
export function unescapeMerchantKeyDollars(value: string): string {
  return value.replace(/\$\$/g, "$");
}

export function isLikelyTruncatedMerchantKey(key: string): boolean {
  return (
    key.length < BCRYPT_MERCHANT_KEY_EXACT_LENGTH &&
    (key.startsWith(".") || key.startsWith("y$10$") || !key.startsWith("$"))
  );
}

/**
 * Next.js/dotenv-expand $ karakterlerini yiyebilir.
 * Öncelik: SIPAY_MERCHANT_KEY_B64 → SIPAY_MERCHANT_KEY (+ $$ escape)
 */
export function resolveMerchantKeyFromProcessEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const b64 = env.SIPAY_MERCHANT_KEY_B64?.trim();
  if (b64) {
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      return normalizeMerchantKey(decoded);
    } catch {
      throw new Error("SIPAY_MERCHANT_KEY_B64 geçersiz base64.");
    }
  }

  const raw = normalizeMerchantKey(env.SIPAY_MERCHANT_KEY);
  return unescapeMerchantKeyDollars(raw);
}

export function encodeMerchantKeyToBase64(key: string): string {
  return Buffer.from(key, "utf8").toString("base64");
}

export function normalizeMerchantId(value: unknown): string {
  return readRawEnvString(value).trim();
}

const sipayEnvSchema = z.object({
  SIPAY_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SIPAY_ENV: z.preprocess(
    (v) => normalizeSipayEnvName(v),
    z.enum(CANONICAL_SIPAY_ENV),
  ),
  SIPAY_APP_ID: z.preprocess(readRawEnvString, z.string().min(1, "SIPAY_APP_ID required")),
  SIPAY_APP_SECRET: z.preprocess(
    readRawEnvString,
    z.string().min(1, "SIPAY_APP_SECRET required"),
  ),
  SIPAY_MERCHANT_KEY: z.preprocess(
    () => resolveMerchantKeyFromProcessEnv(),
    z.string().min(32, "SIPAY_MERCHANT_KEY must be ≥32 chars"),
  ),
  SIPAY_MERCHANT_ID: z.preprocess(
    (v) => normalizeMerchantId(v),
    z.string().min(1, "SIPAY_MERCHANT_ID required"),
  ),
  SIPAY_SALE_WEBHOOK_KEY: z.preprocess(
    (v) => readRawEnvString(v),
    z.string().optional().default(""),
  ),
  SIPAY_BASE_URL: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim().length > 0 ? normalizeSipayBaseUrl(v) : undefined),
      z
        .string()
        .url()
        .refine(
          (url) => SIPAY_ALLOWED_ORIGINS.some((origin) => url.startsWith(origin)),
          {
            message: `SIPAY_BASE_URL must start with: ${SIPAY_ALLOWED_ORIGINS.join(", ")}`,
          },
        )
        .optional(),
    ),
  SIPAY_RETURN_URL: billingCallbackUrlSchema,
  SIPAY_CANCEL_URL: billingCallbackUrlSchema,
});

export type SipayEnv = z.infer<typeof sipayEnvSchema>;

export type SipayMerchantKeyMetadata = {
  present: boolean;
  length: number;
  bcryptPrefix: boolean;
};

export type SipaySafeConfigDebug = {
  environment: CanonicalSipayEnv;
  baseUrl: string;
  merchantId: string;
  merchantKeyLength: number;
  merchantKeyPreview: string;
  merchantKeyBcryptPrefix: boolean;
  appId: string;
};

let _cached: SipayEnv | null = null;

export function maskCredentialPreview(value: string): {
  length: number;
  prefix: string;
  suffix: string;
} {
  if (value.length <= 8) {
    return { length: value.length, prefix: "****", suffix: "****" };
  }
  return {
    length: value.length,
    prefix: value.slice(0, 4),
    suffix: value.slice(-4),
  };
}

export function getSipayMerchantKeyMetadata(
  raw: string | null | undefined = process.env.SIPAY_MERCHANT_KEY,
): SipayMerchantKeyMetadata {
  const key = typeof raw === "string" ? raw : "";
  return {
    present: key.length > 0,
    length: key.length,
    bcryptPrefix: key.startsWith(BCRYPT_MERCHANT_KEY_PREFIX),
  };
}

export function buildSipaySafeConfigDebug(
  env: SipayEnv = getSipayEnv(),
): SipaySafeConfigDebug {
  const baseUrl = getSipayBaseUrl(env);
  const preview = maskCredentialPreview(env.SIPAY_MERCHANT_KEY);
  const meta = getSipayMerchantKeyMetadata(env.SIPAY_MERCHANT_KEY);
  return {
    environment: env.SIPAY_ENV,
    baseUrl,
    merchantId: env.SIPAY_MERCHANT_ID,
    merchantKeyLength: preview.length,
    merchantKeyPreview: `${preview.prefix}…${preview.suffix}`,
    merchantKeyBcryptPrefix: meta.bcryptPrefix,
    appId: env.SIPAY_APP_ID,
  };
}

/** Geçici güvenli config özeti — secret/token loglamaz. */
export function logSipaySafeConfigDebug(context?: string): SipaySafeConfigDebug {
  const debug = buildSipaySafeConfigDebug();
  const label = context ? `[sipay-config] ${context}` : "[sipay-config]";
  console.info(label, debug);
  return debug;
}

function assertMerchantKeyIntegrity(key: string, sipayEnv: CanonicalSipayEnv) {
  if (key.startsWith("y$10$")) {
    throw new Error(
      "SIPAY_MERCHANT_KEY $2 prefix eksik — SIPAY_MERCHANT_KEY_B64 kullanın veya her $ için $$ yazın.",
    );
  }

  if (sipayEnv === "live" || key.includes("$")) {
    if (isLikelyTruncatedMerchantKey(key)) {
      throw new Error(
        `SIPAY_MERCHANT_KEY bozuk görünüyor (uzunluk: ${key.length}, beklenen: ${BCRYPT_MERCHANT_KEY_EXACT_LENGTH}). ` +
          "Next.js .env dosyası $ karakterlerini siliyor. Çözüm: SIPAY_MERCHANT_KEY_B64 kullanın " +
          "(scripts/gen-merchant-key-b64.mjs) veya SIPAY_MERCHANT_KEY içinde her $ için $$ yazın.",
      );
    }

    if (!key.startsWith(BCRYPT_MERCHANT_KEY_PREFIX)) {
      throw new Error(
        "SIPAY_MERCHANT_KEY $2y$10$ ile başlamalı — canlı ortamda geçerli bcrypt merchant key gerekir.",
      );
    }

    if (key.length !== BCRYPT_MERCHANT_KEY_EXACT_LENGTH) {
      throw new Error(
        `SIPAY_MERCHANT_KEY uzunluğu ${BCRYPT_MERCHANT_KEY_EXACT_LENGTH} olmalı (şu an: ${key.length}).`,
      );
    }
  }

  if (sipayEnv === "live" && key === SIPAY_SANDBOX_MERCHANT_KEY) {
    throw new Error(
      "SIPAY_ENV=live iken sandbox merchant key kullanılamaz — canlı panelden merchant key alın.",
    );
  }
}

function assertSipayCredentialEnvironment(
  env: Pick<SipayEnv, "SIPAY_ENV" | "SIPAY_MERCHANT_KEY" | "SIPAY_BASE_URL">,
): void {
  const baseUrl = getSipayBaseUrl(env);
  if (env.SIPAY_ENV === "live" && !baseUrl.startsWith(SIPAY_LIVE_API_BASE)) {
    throw new Error(
      `SIPAY_ENV=live iken API base ${SIPAY_LIVE_API_BASE} olmalı (şu an: ${baseUrl}).`,
    );
  }
  if (env.SIPAY_ENV === "test" && baseUrl.startsWith(SIPAY_LIVE_API_BASE)) {
    throw new Error("SIPAY_ENV=test iken canlı API base kullanılamaz.");
  }
}

export function getSipayEnv(): SipayEnv {
  if (_cached) return _cached;
  const result = sipayEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Sipay env config invalid:\n${result.error.message}`);
  }
  assertMerchantKeyIntegrity(result.data.SIPAY_MERCHANT_KEY, result.data.SIPAY_ENV);
  assertSipayCredentialEnvironment(result.data);
  _cached = result.data;
  return _cached;
}

export function getSipayBaseUrl(env: Pick<SipayEnv, "SIPAY_ENV" | "SIPAY_BASE_URL">): string {
  if (env.SIPAY_BASE_URL) return env.SIPAY_BASE_URL;
  return env.SIPAY_ENV === "live" ? SIPAY_LIVE_API_BASE : SIPAY_TEST_API_BASE;
}

export function validateReturnUrl(url: string): void {
  const allowed = SIPAY_ALLOWED_ORIGINS.some((base) => url.startsWith(base));
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
