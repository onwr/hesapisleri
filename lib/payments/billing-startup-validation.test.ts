import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { validateBillingProviderConfigOnStartup } from "./billing-startup-validation";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("billing-startup-validation", () => {
  it("SIPAY seçili ama disabled → hata", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "SIPAY";
    process.env.SIPAY_ENABLED = "false";
    assert.throws(() => validateBillingProviderConfigOnStartup(), /SIPAY_ENABLED/);
  });

  it("SIPAY seçili ve env tam → geçer", () => {
    process.env.BILLING_PAYMENT_PROVIDER = "SIPAY";
    process.env.SIPAY_ENABLED = "true";
    process.env.SIPAY_ENV = "test";
    process.env.SIPAY_APP_ID = "app";
    process.env.SIPAY_APP_SECRET = "secret_32bytes_padding_00000000";
    process.env.SIPAY_MERCHANT_KEY = "merchant_key_32bytes_padding_0000";
    process.env.SIPAY_MERCHANT_ID = "mid";
    process.env.SIPAY_SALE_WEBHOOK_KEY = "webhook_key_32bytes_padding_00";
    process.env.SIPAY_RETURN_URL = "https://hesapisleri.com/api/billing/sipay/return";
    process.env.SIPAY_CANCEL_URL = "https://hesapisleri.com/api/billing/sipay/cancel";
    assert.doesNotThrow(() => validateBillingProviderConfigOnStartup());
  });
});
