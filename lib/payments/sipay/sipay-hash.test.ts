import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generatePurchaseHash,
  generateCheckStatusHash,
  generateRefundHash,
  validateReturnHash,
  validateWebhookHash,
  encryptAES256CBC,
  decryptAES256CBC,
  _testEncrypt,
  _testDecrypt,
  _parseHashComponentsForTest,
  buildCheckStatusHashPlaintext,
  buildRefundHashPlaintext,
  buildReturnHashPlaintext,
} from "./sipay-hash";
import { SipayHashError } from "./sipay-errors";
import { assertValidReturnHash } from "./sipay-hash";

const FIXED_APP_SECRET = "test_app_secret_32bytes_padding0";
const FIXED_MERCHANT_KEY = "merchant_key_32bytes_padding_0000";

function fixture_decrypt(hash: string): string {
  return _testDecrypt(hash, FIXED_APP_SECRET);
}

describe("sipay-hash — production IV/salt entropy", () => {
  it("aynı payload iki kez hashlenince hash değerleri farklı", () => {
    const params = {
      appId: "app123",
      invoiceId: "SI-001",
      total: "99.90",
      currencyCode: "TRY",
      cancelUrl: "https://hesapisleri.com/cancel",
      returnUrl: "https://hesapisleri.com/return",
      appSecret: FIXED_APP_SECRET,
    };
    const h1 = generatePurchaseHash(params);
    const h2 = generatePurchaseHash(params);
    assert.notEqual(h1, h2);
  });

  it("iki hash de aynı plaintext'e decrypt oluyor", () => {
    const data = "payload-abc";
    const h1 = encryptAES256CBC(data, FIXED_APP_SECRET);
    const h2 = encryptAES256CBC(data, FIXED_APP_SECRET);
    assert.equal(decryptAES256CBC(h1, FIXED_APP_SECRET), data);
    assert.equal(decryptAES256CBC(h2, FIXED_APP_SECRET), data);
  });

  it("IV uzunluğu 16 byte", () => {
    const hash = encryptAES256CBC("x", FIXED_APP_SECRET);
    const { iv } = _parseHashComponentsForTest(hash);
    assert.equal(iv.length, 16);
  });

  it("salt farklı üretimlerde değişir", () => {
    const h1 = encryptAES256CBC("x", FIXED_APP_SECRET);
    const h2 = encryptAES256CBC("x", FIXED_APP_SECRET);
    const s1 = _parseHashComponentsForTest(h1).salt;
    const s2 = _parseHashComponentsForTest(h2).salt;
    assert.notEqual(s1.toString("hex"), s2.toString("hex"));
  });

  it("wrong secret decrypt olmuyor", () => {
    const hash = encryptAES256CBC("secret-data", FIXED_APP_SECRET);
    assert.throws(
      () => decryptAES256CBC(hash, "wrong_secret_32bytes_padding_000"),
      SipayHashError,
    );
  });

  it("malformed component count reddedilir", () => {
    assert.throws(() => decryptAES256CBC("only-one-part", FIXED_APP_SECRET), SipayHashError);
  });

  it("invalid IV length reddedilir", () => {
    const bad = `${Buffer.from("short").toString("base64")}:${Buffer.alloc(16).toString("base64")}:YWJj`;
    assert.throws(() => decryptAES256CBC(bad, FIXED_APP_SECRET), /IV length/i);
  });

  it("invalid salt length reddedilir", () => {
    const bad = `${Buffer.alloc(16).toString("base64")}:${Buffer.from("x").toString("base64")}:YWJj`;
    assert.throws(() => decryptAES256CBC(bad, FIXED_APP_SECRET), /salt length/i);
  });
});

describe("sipay-hash — deterministic test helper", () => {
  it("encrypt → decrypt round-trip", () => {
    const encrypted = _testEncrypt("hello world", FIXED_APP_SECRET);
    const decrypted = _testDecrypt(encrypted, FIXED_APP_SECRET);
    assert.equal(decrypted, "hello world");
  });

  it("deterministik helper aynı data → aynı hash", () => {
    const h1 = _testEncrypt("invoice123merchantkey", FIXED_APP_SECRET);
    const h2 = _testEncrypt("invoice123merchantkey", FIXED_APP_SECRET);
    assert.equal(h1, h2);
  });
});

describe("sipay-hash — checkstatus plaintext order", () => {
  it("invoice_id + merchant_key + app_secret", () => {
    const params = {
      invoiceId: "SI-001",
      merchantKey: FIXED_MERCHANT_KEY,
      appSecret: FIXED_APP_SECRET,
    };
    assert.equal(
      buildCheckStatusHashPlaintext(params),
      `${params.invoiceId}${params.merchantKey}${params.appSecret}`,
    );
    const hash = generateCheckStatusHash(params);
    const decrypted = fixture_decrypt(hash);
    assert.equal(decrypted, buildCheckStatusHashPlaintext(params));
  });
});

describe("sipay-hash — refund plaintext order", () => {
  it("amount + invoice_id + merchant_key + app_secret", () => {
    const params = {
      amount: "50.00",
      invoiceId: "SI-001",
      merchantKey: FIXED_MERCHANT_KEY,
      appSecret: FIXED_APP_SECRET,
    };
    assert.equal(
      buildRefundHashPlaintext(params),
      `${params.amount}${params.invoiceId}${params.merchantKey}${params.appSecret}`,
    );
    const hash = generateRefundHash(params);
    assert.equal(fixture_decrypt(hash), buildRefundHashPlaintext(params));
  });
});

describe("sipay-hash — purchase hash order", () => {
  it("app_id + invoice_id + total + currency + cancel + return", () => {
    const params = {
      appId: "app123",
      invoiceId: "SI-001",
      total: "99.90",
      currencyCode: "TRY",
      cancelUrl: "https://hesapisleri.com/cancel",
      returnUrl: "https://hesapisleri.com/return",
      appSecret: FIXED_APP_SECRET,
    };
    const hash = generatePurchaseHash(params);
    const decrypted = fixture_decrypt(hash);
    const expected = `${params.appId}${params.invoiceId}${params.total}${params.currencyCode}${params.cancelUrl}${params.returnUrl}`;
    assert.equal(decrypted, expected);
  });
});

describe("sipay-hash — return callback", () => {
  it("invoice_id + merchant_key doğrulanır", () => {
    const invoiceId = "SI-001";
    const hashKey = _testEncrypt(buildReturnHashPlaintext({ invoiceId, merchantKey: FIXED_MERCHANT_KEY }), FIXED_APP_SECRET);
    assert.ok(
      validateReturnHash({
        hashKey,
        invoiceId,
        merchantKey: FIXED_MERCHANT_KEY,
        appSecret: FIXED_APP_SECRET,
      }),
    );
  });

  it("URL-safe base64 (__ → /)", () => {
    const data = "test";
    const normal = _testEncrypt(data, FIXED_APP_SECRET);
    const urlSafe = normal.replace(/\//g, "__");
    assert.equal(_testDecrypt(urlSafe, FIXED_APP_SECRET), data);
  });

  it("hash_key eksikse assertValid hata fırlatır", () => {
    assert.throws(
      () =>
        assertValidReturnHash({
          hashKey: undefined,
          invoiceId: "SI-001",
          merchantKey: FIXED_MERCHANT_KEY,
          appSecret: FIXED_APP_SECRET,
        }),
      SipayHashError,
    );
  });
});

describe("sipay-hash — webhook hash", () => {
  it("invoice_id + order_no + status", () => {
    const webhookKey = FIXED_MERCHANT_KEY;
    const hashKey = _testEncrypt("SI-001ORD-0011", webhookKey);
    assert.ok(
      validateWebhookHash({
        hashKey,
        invoiceId: "SI-001",
        orderNo: "ORD-001",
        status: "1",
        webhookKey,
      }),
    );
  });
});
