import "server-only";

import {
  getActiveBillingProvider,
  isPaytrEnabled,
  isSipayEnabled,
} from "./billing-provider-resolver";
import { getSipayEnv, getSipayBaseUrl, SIPAY_ALLOWED_BASE_URLS } from "./sipay/sipay-env";
import { getPaytrConfig } from "./providers/paytr/paytr-config";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function assertHttpsUrl(name: string, url: string): void {
  if (!url.startsWith("https://")) {
    throw new Error(`${name} HTTPS olmalıdır.`);
  }
}

function validateSipayConfig(): void {
  if (!isSipayEnabled()) {
    throw new Error("BILLING_PAYMENT_PROVIDER=SIPAY ancak SIPAY_ENABLED=true değil.");
  }

  const env = getSipayEnv();
  const baseUrl = getSipayBaseUrl(env);

  if (env.SIPAY_ENV === "live" && !baseUrl.startsWith("https://app.sipay.com.tr")) {
    throw new Error("SIPAY_ENV=live iken base URL app.sipay.com.tr olmalıdır.");
  }
  if (env.SIPAY_ENV === "test" && baseUrl.includes("app.sipay.com.tr")) {
    throw new Error("SIPAY_ENV=test iken live domain kullanılamaz.");
  }
  if (!SIPAY_ALLOWED_BASE_URLS.some((allowed) => baseUrl.startsWith(allowed))) {
    throw new Error("SIPAY base URL allowlist dışında.");
  }

  if (isProduction()) {
    assertHttpsUrl("SIPAY_RETURN_URL", env.SIPAY_RETURN_URL);
    assertHttpsUrl("SIPAY_CANCEL_URL", env.SIPAY_CANCEL_URL);
  }
}

function validatePaytrConfig(): void {
  if (!isPaytrEnabled()) {
    throw new Error("BILLING_PAYMENT_PROVIDER=PAYTR ancak PAYTR_ENABLED=false.");
  }
  getPaytrConfig();
}

export function validateBillingProviderConfigOnStartup(): void {
  const selected = getActiveBillingProvider();

  if (selected === "SIPAY") {
    validateSipayConfig();
    return;
  }

  validatePaytrConfig();
}

export function runBillingStartupValidation(): void {
  try {
    validateBillingProviderConfigOnStartup();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Billing config invalid";
    if (isProduction()) {
      throw new Error(`Billing startup validation failed: ${message}`);
    }
    console.warn(`[billing-startup] ${message}`);
  }
}
