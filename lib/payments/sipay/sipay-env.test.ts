import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { SIPAY_ALLOWED_BASE_URLS, _resetSipayEnvCache } from "./sipay-env";
import { getSipayBaseUrl } from "./sipay-env";

describe("sipay-env — SIPAY_ALLOWED_BASE_URLS", () => {
  it("test ve live URL'leri içerir", () => {
    assert.ok(SIPAY_ALLOWED_BASE_URLS.includes("https://provisioning.sipay.com.tr"));
    assert.ok(SIPAY_ALLOWED_BASE_URLS.includes("https://app.sipay.com.tr"));
  });
});

describe("sipay-env — getSipayBaseUrl", () => {
  it("test env için provisioning URL döner", () => {
    const url = getSipayBaseUrl({ SIPAY_ENV: "test", SIPAY_BASE_URL: undefined });
    assert.equal(url, "https://provisioning.sipay.com.tr");
  });

  it("live env için app URL döner", () => {
    const url = getSipayBaseUrl({ SIPAY_ENV: "live", SIPAY_BASE_URL: undefined });
    assert.equal(url, "https://app.sipay.com.tr");
  });

  it("SIPAY_BASE_URL varsa onu kullanır", () => {
    const url = getSipayBaseUrl({
      SIPAY_ENV: "test",
      SIPAY_BASE_URL: "https://provisioning.sipay.com.tr",
    });
    assert.equal(url, "https://provisioning.sipay.com.tr");
  });
});

describe("sipay-env — getSipayEnv validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetSipayEnvCache();
  });

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SIPAY_")) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
    _resetSipayEnvCache();
  });

  it("zorunlu alanlar eksikse hata fırlatır", async () => {
    delete process.env.SIPAY_APP_ID;
    delete process.env.SIPAY_APP_SECRET;
    delete process.env.SIPAY_MERCHANT_KEY;
    delete process.env.SIPAY_MERCHANT_ID;
    delete process.env.SIPAY_RETURN_URL;
    delete process.env.SIPAY_CANCEL_URL;

    const { getSipayEnv: getSipayEnvFresh } = await import("./sipay-env");
    assert.throws(() => getSipayEnvFresh(), /Sipay env config invalid/);
  });

  it("SIPAY_SALE_WEBHOOK_KEY boşken startup geçer", async () => {
    process.env.SIPAY_APP_ID = "appid";
    process.env.SIPAY_APP_SECRET = "secret";
    process.env.SIPAY_MERCHANT_KEY = "merchant_key_32bytes_padding_0000";
    process.env.SIPAY_MERCHANT_ID = "merchantid";
    process.env.SIPAY_SALE_WEBHOOK_KEY = "";
    process.env.SIPAY_RETURN_URL = "http://localhost:3000/api/billing/sipay/return";
    process.env.SIPAY_CANCEL_URL = "http://localhost:3000/api/billing/sipay/cancel";

    const { getSipayEnv: getSipayEnvFresh } = await import("./sipay-env");
    const env = getSipayEnvFresh();
    assert.equal(env.SIPAY_SALE_WEBHOOK_KEY, "");
  });

  it("bcrypt merchant key metadata doğrulanır", async () => {
    const { getSipayMerchantKeyMetadata } = await import("./sipay-env");
    const sampleKey =
      "$2y$10$abcdefghijklmnopqrstuvwx0123456789012345678901234567890";
    const meta = getSipayMerchantKeyMetadata(sampleKey);
    assert.equal(meta.present, true);
    assert.equal(meta.bcryptPrefix, true);
    assert.ok(meta.length >= 60);
  });

  it("bcrypt prefix bozuksa hata fırlatır", async () => {
    process.env.SIPAY_APP_ID = "appid";
    process.env.SIPAY_APP_SECRET = "secret";
    process.env.SIPAY_MERCHANT_KEY = "$2x$10$brokenmerchantkeypadding000000000";
    process.env.SIPAY_MERCHANT_ID = "merchantid";
    process.env.SIPAY_RETURN_URL = "https://hesapisleri.com/return";
    process.env.SIPAY_CANCEL_URL = "https://hesapisleri.com/cancel";

    const { getSipayEnv: getSipayEnvFresh } = await import("./sipay-env");
    assert.throws(() => getSipayEnvFresh(), /\$2y\$10\$/);
  });

  it("allowlist dışı SIPAY_BASE_URL reddedilir", async () => {
    process.env.SIPAY_APP_ID = "appid";
    process.env.SIPAY_APP_SECRET = "secret";
    process.env.SIPAY_MERCHANT_KEY = "merchant_key_123456789012345678"; // 32 chars
    process.env.SIPAY_MERCHANT_ID = "merchantid";
    process.env.SIPAY_SALE_WEBHOOK_KEY = "webhookkey";
    process.env.SIPAY_RETURN_URL = "https://hesapisleri.com/return";
    process.env.SIPAY_CANCEL_URL = "https://hesapisleri.com/cancel";
    process.env.SIPAY_BASE_URL = "https://evil.com";

    const { getSipayEnv: getSipayEnvFresh } = await import("./sipay-env");
    assert.throws(() => getSipayEnvFresh(), /allowlist|sipay/i);
  });
});
