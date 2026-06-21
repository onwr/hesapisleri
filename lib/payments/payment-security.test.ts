import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decimalToMinor,
  formatPaytrDecimalAmount,
  formatPaytrMinorAmount,
  parsePaytrDecimalAmount,
  parsePaytrMinorAmount,
} from "./money";
import { generatePaytrMerchantOid } from "./merchant-oid";
import {
  assertPaymentTransition,
  assertSubscriptionTransition,
} from "./payment-state-machine";
import {
  decryptPaymentToken,
  encryptPaymentToken,
  fingerprintPaymentToken,
} from "./payment-token-crypto";

describe("payment money helpers", () => {
  it("479 TL minor amount değerine çevrilir", () => {
    assert.equal(decimalToMinor("479.00"), 47900);
    assert.equal(parsePaytrDecimalAmount("479.00"), 47900);
    assert.equal(parsePaytrMinorAmount("47900"), 47900);
  });

  it("PayTR amount formatları nokta ve minor kullanır", () => {
    assert.equal(formatPaytrDecimalAmount(47900), "479.00");
    assert.equal(formatPaytrMinorAmount(47900), "47900");
  });

  it("negatif ve sıfır tutarı reddeder", () => {
    assert.throws(() => decimalToMinor("0"));
    assert.throws(() => formatPaytrMinorAmount(-1));
  });
});

describe("merchant oid", () => {
  it("alfanümerik ve PayTR limitine uygun üretir", () => {
    const oid = generatePaytrMerchantOid(new Date("2026-06-19T00:00:00.000Z"));
    assert.match(oid, /^HI20260619[A-F0-9]+$/);
    assert.ok(oid.length <= 64);
  });
});

describe("payment state machine", () => {
  it("izinli ve izinsiz payment geçişlerini ayırır", () => {
    assert.doesNotThrow(() => assertPaymentTransition("FORM_READY", "WAIT_CALLBACK"));
    assert.throws(() => assertPaymentTransition("PAID", "FAILED"));
  });

  it("subscription grace geçişlerini doğrular", () => {
    assert.doesNotThrow(() => assertSubscriptionTransition("PAST_DUE", "GRACE_PERIOD"));
    assert.throws(() => assertSubscriptionTransition("CANCELLED", "PAST_DUE"));
  });
});

describe("payment token crypto", () => {
  it("token encrypt/decrypt ve fingerprint üretir", () => {
    process.env.PAYMENT_TOKEN_ENCRYPTION_KEY = "12345678901234567890123456789012";
    const encrypted = encryptPaymentToken("utoken-secret");
    assert.notEqual(encrypted, "utoken-secret");
    assert.equal(decryptPaymentToken(encrypted), "utoken-secret");
    assert.equal(fingerprintPaymentToken("a"), fingerprintPaymentToken("a"));
  });
});
