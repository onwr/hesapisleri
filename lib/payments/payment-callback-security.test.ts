/**
 * PayTR callback güvenlik testleri — HMAC, tutar, idempotency sinyalleri.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createPaytrCallbackHash,
  verifyPaytrCallbackHash,
} from "./providers/paytr/paytr-hash.js";
import { verifyPaytrCallback } from "./providers/paytr/paytr-callback.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const config = {
  merchantId: "123456",
  merchantKey: "merchant-key-secret",
  merchantSalt: "merchant-salt-secret",
  testMode: true,
  integrationMode: "iframe" as const,
  directApiEnabled: true,
  cardStorageEnabled: true,
  recurringEnabled: true,
  non3dEnabled: true,
  callbackUrl: "https://example.com/api/payments/paytr/callback",
  okUrl: "https://example.com/ok",
  failUrl: "https://example.com/fail",
};

function successPayload(hash: string) {
  return {
    merchant_oid: "HI20260619ABC",
    status: "success",
    total_amount: "47900",
    hash,
    currency: "TL",
    test_mode: "1",
  };
}

describe("PayTR callback HMAC", () => {
  it("doğru HMAC kabul edilir", () => {
    const hash = createPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "success", totalAmount: "47900" },
      config
    );
    assert.equal(verifyPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "success", totalAmount: "47900", hash },
      config
    ), true);
  });

  it("yanlış HMAC reddedilir", () => {
    const hash = createPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "success", totalAmount: "47900" },
      config
    );
    assert.equal(verifyPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "success", totalAmount: "47900", hash: `${hash}x` },
      config
    ), false);
  });
});

describe("PayTR callback normalization", () => {
  it("amount ve currency normalize edilir", () => {
    process.env.PAYTR_MERCHANT_ID = config.merchantId;
    process.env.PAYTR_MERCHANT_KEY = config.merchantKey;
    process.env.PAYTR_MERCHANT_SALT = config.merchantSalt;
    process.env.PAYTR_TEST_MODE = "1";

    const hash = createPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "success", totalAmount: "47900" },
      config
    );
    const verified = verifyPaytrCallback(successPayload(hash));
    assert.equal(verified.totalAmountMinor, 47900);
    assert.equal(verified.currency, "TRY");
    assert.equal(verified.testMode, true);
  });

  it("failed status PAID değildir", () => {
    process.env.PAYTR_MERCHANT_ID = config.merchantId;
    process.env.PAYTR_MERCHANT_KEY = config.merchantKey;
    process.env.PAYTR_MERCHANT_SALT = config.merchantSalt;
    process.env.PAYTR_TEST_MODE = "1";

    const hash = createPaytrCallbackHash(
      { merchantOid: "HI20260619ABC", status: "failed", totalAmount: "47900" },
      config
    );
    const verified = verifyPaytrCallback({
      ...successPayload(hash),
      status: "failed",
    });
    assert.equal(verified.status, "failed");
  });
});

describe("callback endpoint security policy", () => {
  it("callback route admin auth gerektirmez", () => {
    const source = readFileSync(
      join(webRoot, "app/api/payments/paytr/callback/route.ts"),
      "utf8"
    );
    assert.ok(!source.includes("requireSuperAdminApi"));
  });

  it("callback route provider doğrulaması kullanır", () => {
    const source = readFileSync(
      join(webRoot, "app/api/payments/paytr/callback/route.ts"),
      "utf8"
    );
    assert.ok(
      source.includes("processPaytrCallback") || source.includes("verifyPaytrCallback")
    );
  });

  it("processPaytrCallback amount/currency/testMode kontrol eder", () => {
    const source = readFileSync(join(webRoot, "lib/payments/payment-service.ts"), "utf8");
    assert.ok(source.includes("amountMinor !== verified.totalAmountMinor"));
    assert.ok(source.includes("normalizeCurrency"));
    assert.ok(source.includes("testMode !== verified.testMode"));
    assert.ok(source.includes("processingStatus === \"PROCESSED\""));
    assert.ok(source.includes("attemptCount"));
  });

  it("admin webhook query rawPayload seçmez", () => {
    const source = readFileSync(
      join(webRoot, "lib/admin/payments/admin-payment-event-service.ts"),
      "utf8"
    );
    assert.ok(!("rawPayload" in { id: true }));
    assert.ok(source.includes("WEBHOOK_SAFE_SELECT"));
    assert.ok(!source.includes("rawPayload: true"));
    assert.ok(!source.includes("payloadHash: true"));
  });
});
