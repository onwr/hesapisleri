import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPaytrCallbackHash,
  createPaytrDirectPaymentToken,
  createPaytrIframeToken,
  verifyPaytrCallbackHash,
} from "./paytr-hash";
import { verifyPaytrCallback } from "./paytr-callback";

const config = {
  merchantId: "123456",
  merchantKey: "merchant-key",
  merchantSalt: "merchant-salt",
  testMode: true,
  integrationMode: "iframe" as const,
  directApiEnabled: true,
  cardStorageEnabled: true,
  recurringEnabled: true,
  non3dEnabled: true,
  callbackUrl: "https://example.com/api/payments/paytr/callback",
  okUrl: "https://example.com/settings/billing/payment/success",
  failUrl: "https://example.com/settings/billing/payment/fail",
};

describe("paytr hash helpers", () => {
  it("direct payment token deterministik üretir", () => {
    const token = createPaytrDirectPaymentToken(
      {
        userIp: "127.0.0.1",
        merchantOid: "HI20260619ABC",
        email: "test@example.com",
        paymentAmount: "479.00",
        paymentType: "card",
        installmentCount: "0",
        currency: "TL",
        testMode: "1",
        non3d: "0",
      },
      config
    );

    assert.equal(typeof token, "string");
    assert.ok(token.length > 20);
  });

  it("iframe payment token deterministik üretir", () => {
    const token = createPaytrIframeToken(
      {
        userIp: "127.0.0.1",
        merchantOid: "HI20260619ABC",
        email: "test@example.com",
        paymentAmountMinor: "179880",
        userBasket: "dGVzdA==",
        noInstallment: "1",
        maxInstallment: "0",
        currency: "TL",
        testMode: "1",
      },
      config
    );

    assert.equal(typeof token, "string");
    assert.ok(token.length > 20);
  });

  it("callback hash doğrular ve yanlış hash reddeder", () => {
    const hash = createPaytrCallbackHash(
      {
        merchantOid: "HI20260619ABC",
        status: "success",
        totalAmount: "47900",
      },
      config
    );

    assert.equal(
      verifyPaytrCallbackHash(
        {
          merchantOid: "HI20260619ABC",
          status: "success",
          totalAmount: "47900",
          hash,
        },
        config
      ),
      true
    );
    assert.equal(
      verifyPaytrCallbackHash(
        {
          merchantOid: "HI20260619ABC",
          status: "success",
          totalAmount: "47900",
          hash: `${hash}x`,
        },
        config
      ),
      false
    );
  });

  it("callback payload normalize eder", () => {
    process.env.PAYTR_MERCHANT_ID = config.merchantId;
    process.env.PAYTR_MERCHANT_KEY = config.merchantKey;
    process.env.PAYTR_MERCHANT_SALT = config.merchantSalt;
    process.env.PAYTR_TEST_MODE = "1";

    const hash = createPaytrCallbackHash(
      {
        merchantOid: "HI20260619ABC",
        status: "success",
        totalAmount: "47900",
      },
      config
    );

    const verified = verifyPaytrCallback({
      merchant_oid: "HI20260619ABC",
      status: "success",
      total_amount: "47900",
      hash,
      currency: "TL",
      test_mode: "1",
    });

    assert.equal(verified.status, "success");
    assert.equal(verified.currency, "TRY");
    assert.equal(verified.totalAmountMinor, 47900);
  });
});
