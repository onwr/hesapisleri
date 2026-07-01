export type BillingPaymentProviderName = "SIPAY" | "PAYTR";

export type BillingCheckoutProviderInfo = {
  provider: BillingPaymentProviderName;
  sipayEnabled: boolean;
  paytrEnabled: boolean;
};

let warnedMissingProvider = false;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function normalizeBillingPaymentProvider(
  raw: string,
): BillingPaymentProviderName {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "SIPAY") return "SIPAY";
  if (normalized === "PAYTR") return "PAYTR";
  throw new Error(`Geçersiz BILLING_PAYMENT_PROVIDER: ${raw}`);
}

/** Seçili checkout provider — unset ise production'da hata; dev'de SIPAY_ENABLED öncelikli. */
export function resolveBillingPaymentProviderRaw(): BillingPaymentProviderName {
  const raw = process.env.BILLING_PAYMENT_PROVIDER?.trim();
  if (!raw) {
    if (isProduction()) {
      throw new Error("BILLING_PAYMENT_PROVIDER tanımlı değil.");
    }
    if (isSipayEnabled()) {
      if (!warnedMissingProvider) {
        console.warn(
          "[billing] BILLING_PAYMENT_PROVIDER tanımlı değil — SIPAY_ENABLED=true, development fallback: SIPAY checkout.",
        );
        warnedMissingProvider = true;
      }
      return "SIPAY";
    }
    if (!warnedMissingProvider) {
      console.warn(
        "[billing] BILLING_PAYMENT_PROVIDER tanımlı değil — development fallback: PAYTR checkout.",
      );
      warnedMissingProvider = true;
    }
    return "PAYTR";
  }
  return normalizeBillingPaymentProvider(raw);
}

export function getActiveBillingProvider(): BillingPaymentProviderName {
  return resolveBillingPaymentProviderRaw();
}

export function isSipayEnabled(): boolean {
  return process.env.SIPAY_ENABLED === "true";
}

/** Varsayılan: PayTR etkin (geriye dönük uyumluluk). */
export function isPaytrEnabled(): boolean {
  return process.env.PAYTR_ENABLED !== "false";
}

export function getBillingPaymentProvider(): BillingCheckoutProviderInfo {
  const provider = resolveBillingPaymentProviderRaw();
  const sipayEnabled = isSipayEnabled();
  const paytrEnabled = isPaytrEnabled();

  if (provider === "SIPAY" && !sipayEnabled) {
    throw new Error(
      "BILLING_PAYMENT_PROVIDER=SIPAY ancak SIPAY_ENABLED=true değil.",
    );
  }
  if (provider === "PAYTR" && !paytrEnabled) {
    throw new Error(
      "BILLING_PAYMENT_PROVIDER=PAYTR ancak PAYTR_ENABLED=false.",
    );
  }

  return { provider, sipayEnabled, paytrEnabled };
}

export function isSipayCheckoutActive(): boolean {
  const info = getBillingPaymentProvider();
  return info.provider === "SIPAY" && info.sipayEnabled;
}

export function isPaytrCheckoutActive(): boolean {
  const info = getBillingPaymentProvider();
  return info.provider === "PAYTR" && info.paytrEnabled;
}

/** Seçilen provider kapalıysa yapılandırma hatası. */
export function validateBillingProviderConfig(): void {
  getBillingPaymentProvider();
}

export function getCheckoutProviderForClient(): BillingCheckoutProviderInfo {
  return getBillingPaymentProvider();
}

/** Test helper */
export function _resetBillingProviderWarnings(): void {
  warnedMissingProvider = false;
}
