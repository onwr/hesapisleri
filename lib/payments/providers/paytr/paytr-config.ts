import "server-only";

export type PaytrIntegrationMode = "iframe" | "direct";

export type PaytrConfig = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  testMode: boolean;
  integrationMode: PaytrIntegrationMode;
  directApiEnabled: boolean;
  cardStorageEnabled: boolean;
  recurringEnabled: boolean;
  non3dEnabled: boolean;
  callbackUrl: string;
  okUrl: string;
  failUrl: string;
};

function readFlag(name: string) {
  return ["1", "true", "yes", "on"].includes(
    (process.env[name] ?? "").toLowerCase()
  );
}

function requireEnv(name: string, productionRequired = true) {
  const value = process.env[name]?.trim();
  if (!value && (productionRequired || process.env.NODE_ENV === "production")) {
    throw new Error(`${name} yapılandırılmamış.`);
  }
  return value ?? "";
}

function resolveUrl(name: string, fallbackPath: string) {
  const explicit = process.env[name]?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl && process.env.NODE_ENV === "production") {
    throw new Error(`${name} veya APP_URL yapılandırılmalıdır.`);
  }

  return appUrl ? new URL(fallbackPath, appUrl).toString() : fallbackPath;
}

function resolveIntegrationMode(): PaytrIntegrationMode {
  const explicit = (process.env.PAYTR_INTEGRATION_MODE ?? "").trim().toLowerCase();
  if (explicit === "direct") return "direct";
  return "iframe";
}

export function getPaytrConfig(): PaytrConfig {
  const testMode = readFlag("PAYTR_TEST_MODE") || process.env.NODE_ENV !== "production";
  const integrationMode = resolveIntegrationMode();

  return {
    merchantId: requireEnv("PAYTR_MERCHANT_ID", !testMode),
    merchantKey: requireEnv("PAYTR_MERCHANT_KEY", !testMode),
    merchantSalt: requireEnv("PAYTR_MERCHANT_SALT", !testMode),
    testMode,
    integrationMode,
    directApiEnabled: readFlag("PAYTR_DIRECT_API_ENABLED"),
    cardStorageEnabled: readFlag("PAYTR_CARD_STORAGE_ENABLED"),
    recurringEnabled: readFlag("PAYTR_RECURRING_ENABLED"),
    non3dEnabled: readFlag("PAYTR_NON3D_ENABLED"),
    callbackUrl: resolveUrl("PAYTR_CALLBACK_URL", "/api/payments/paytr/callback"),
    okUrl: resolveUrl(
      "PAYTR_OK_URL",
      "/settings/billing/payment/success"
    ),
    failUrl: resolveUrl(
      "PAYTR_FAIL_URL",
      "/settings/billing/payment/fail"
    ),
  };
}

export function assertPaytrDirectEnabled(config = getPaytrConfig()) {
  if (config.integrationMode !== "direct" || !config.directApiEnabled) {
    throw new Error("PayTR Direkt API yetkisi veya feature flag kapalı.");
  }
}

export const PAYTR_DIRECT_ACTION_URL = "https://www.paytr.com/odeme";
export const PAYTR_IFRAME_BASE_URL = "https://www.paytr.com/odeme/guvenli";
export const PAYTR_API_BASE_URL = "https://www.paytr.com";
