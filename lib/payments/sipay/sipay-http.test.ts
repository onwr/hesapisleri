/**
 * Sipay Faz 1.1 — Mock HTTP entegrasyon testleri
 *
 * Node.js global fetch'ini mock'layarak gerçek HTTP isteği göndermeden
 * provider, client ve hash zincirini uçtan uca test eder.
 *
 * Çalıştır:
 *   npx tsx --test lib/payments/sipay/sipay-http.test.ts
 */
import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { _testEncrypt, buildReturnHashPlaintext } from "./sipay-hash";

// ─── Test Sabitleri ─────────────────────────────────────────────────────────
const APP_SECRET = "test_app_secret_32bytes_padding0"; // 32 char
const MERCHANT_KEY = "merchant_key_32bytes_padding_0000";
const APP_ID = "test-app-id";

// Ortam değişkenleri — provider kodunun process.env'den okuduğu tüm değerler
function setEnv(extra?: Record<string, string>) {
  process.env.SIPAY_ENABLED = "true";
  process.env.SIPAY_ENV = "test";
  process.env.SIPAY_APP_ID = APP_ID;
  process.env.SIPAY_APP_SECRET = APP_SECRET;
  process.env.SIPAY_MERCHANT_KEY = MERCHANT_KEY;
  process.env.SIPAY_MERCHANT_ID = "mid-001";
  process.env.SIPAY_SALE_WEBHOOK_KEY = MERCHANT_KEY;
  process.env.SIPAY_BASE_URL = "https://provisioning.sipay.com.tr";
  process.env.SIPAY_RETURN_URL = "https://hesapisleri.com/api/billing/sipay/return";
  process.env.SIPAY_CANCEL_URL = "https://hesapisleri.com/api/billing/sipay/cancel";
  if (extra) Object.assign(process.env, extra);
}

function clearEnv() {
  for (const k of [
    "SIPAY_ENABLED", "SIPAY_ENV", "SIPAY_APP_ID", "SIPAY_APP_SECRET",
    "SIPAY_MERCHANT_KEY", "SIPAY_MERCHANT_ID", "SIPAY_SALE_WEBHOOK_KEY",
    "SIPAY_BASE_URL", "SIPAY_RETURN_URL", "SIPAY_CANCEL_URL",
  ]) delete process.env[k];
}

// ─── Fetch Mock Yardımcısı ──────────────────────────────────────────────────
type MockHandler = (url: string, opts: RequestInit) => Promise<Response>;
let activeMockHandler: MockHandler | null = null;

function mockFetch(handler: MockHandler) {
  activeMockHandler = handler;
}

// Token response — is_3d=4 (BRANDED destekli)
function tokenResponse() {
  return {
    status_code: 100,
    status_description: "Token oluşturuldu.",
    data: {
      token: "mock-bearer-token",
      is_3d: 4,
      expires_at: new Date(Date.now() + 7200_000).toISOString(),
    },
  };
}

function purchaseLinkResponse(invoiceId: string) {
  return {
    status: true,
    status_code: 100,
    success_message: "Başarılı",
    link: `https://provisioning.sipay.com.tr/pay/${invoiceId}`,
    order_id: `ORD-${invoiceId}`,
  };
}

function checkStatusPaidResponse(invoiceId: string) {
  return {
    status_code: 100,
    status_description: "Başarılı",
    data: {
      invoice_id: invoiceId,
      payment_status: 1,
      transaction_status: "Success",
      transaction_amount: 99.9,
      currency: "TRY",
      transaction_id: "sipay-txn-001",
      order_no: "ORD-001",
      order_id: "ord-id-001",
    },
  };
}

function checkStatusNotPaidResponse(invoiceId: string) {
  return {
    status_code: 100,
    status_description: "İşlem bulunamadı",
    data: {
      invoice_id: invoiceId,
      payment_status: 0,
      transaction_status: "Failed",
    },
  };
}

function checkStatusPendingResponse(invoiceId: string) {
  return {
    status_code: 69, // PENDING
    status_description: "İşlem beklemede",
    data: {
      invoice_id: invoiceId,
      payment_status: 0,
    },
  };
}

function refundSuccessResponse() {
  return {
    status_code: 100,
    status_description: "İade başarılı",
    data: { reference_no: "REF-001" },
  };
}

function refundFailedResponse() {
  return {
    status_code: 200,
    status_description: "İade başarısız",
  };
}

// Node 18+ global fetch — mock with module-level patch
const originalFetch = globalThis.fetch;

function setupFetchMock() {
  // @ts-expect-error override
  globalThis.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    if (!activeMockHandler) throw new Error(`No mock handler set for ${url}`);
    return activeMockHandler(url, init ?? {});
  };
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
  activeMockHandler = null;
}

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("sipay-http — createCheckout (mock fetch)", () => {
  before(() => {
    setEnv();
    setupFetchMock();
  });

  after(() => {
    restoreFetch();
    clearEnv();
    // Reset token cache
    const envMod = require("./sipay-env");
    if (typeof envMod._resetSipayEnvCache === "function") envMod._resetSipayEnvCache();
    const tokenMod = require("./sipay-token-service");
    if (typeof tokenMod._resetTokenCache === "function") tokenMod._resetTokenCache();
  });

  it("token + purchase/link → checkoutUrl döner", async () => {
    const invoiceId = "SI-HTTP-001";
    let callCount = 0;
    let purchaseBody: Record<string, unknown> | null = null;

    mockFetch(async (url, init) => {
      callCount++;
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/purchase/link")) {
        purchaseBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return makeResponse(purchaseLinkResponse(invoiceId));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const provider = createSipayProvider();

    const result = await provider.createCheckout({
      invoiceId,
      idempotencyKey: "idem-001",
      companyId: "company-001",
      userId: "user-001",
      amountMinor: 9990,
      currency: "TRY",
      payerEmail: "test@example.com",
      payerName: "Test Kullanici",
      payerIp: "127.0.0.1",
      items: [{ name: "Pro Plan", priceMinor: 9990, quantity: 1 }],
      returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
      cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
      testMode: true,
    });

    assert.equal(result.invoiceId, invoiceId);
    assert.ok(result.checkoutUrl.startsWith("https://provisioning.sipay.com.tr/"));
    assert.ok(callCount >= 2, "token + purchase/link çağrısı yapılmalı");
    // Provider invoice_id'yi `invoice` JSON string alanı içinde gönderir
    assert.ok(purchaseBody);
    const body = purchaseBody as Record<string, unknown>;
    assert.equal(typeof body["invoice"], "string");
    assert.equal(body["hashKey"], undefined);
    assert.equal(body["body"], undefined);
    assert.equal(body["payload"], undefined);
    assert.equal(body["invoicePayload"], undefined);
    const invoiceObj = JSON.parse(String(body["invoice"])) as { invoice_id: string };
    assert.equal(invoiceObj.invoice_id, invoiceId);
  });

  it("Sipay allowlist dışı URL reddedilir", async () => {
    const invoiceId = "SI-HTTP-BAD-URL";
    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/purchase/link")) {
        return makeResponse({
          status: true,
          status_code: 100,
          link: "https://evil.example.com/pay/xyz",
          order_id: "ORD-evil",
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const provider = createSipayProvider();

    await assert.rejects(
      () =>
        provider.createCheckout({
          invoiceId,
          idempotencyKey: "idem-bad",
          companyId: "c1",
          userId: "u1",
          amountMinor: 9990,
          currency: "TRY",
          payerEmail: "a@b.com",
          payerName: "A B",
          payerIp: "127.0.0.1",
          items: [{ name: "X", priceMinor: 9990, quantity: 1 }],
          returnUrl: "https://hesapisleri.com/api/billing/sipay/return",
          cancelUrl: "https://hesapisleri.com/api/billing/sipay/cancel",
          testMode: true,
        }),
      /allowlist/i,
    );
  });
});

describe("sipay-http — checkStatus (mock fetch)", () => {
  before(() => {
    setEnv();
    setupFetchMock();
  });

  after(() => {
    restoreFetch();
    clearEnv();
  });

  it("payment_status=1 → PAID", async () => {
    const invoiceId = "SI-HTTP-CS-PAID";

    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/api/checkstatus")) return makeResponse(checkStatusPaidResponse(invoiceId));
      throw new Error(`Unexpected: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = await createSipayProvider().checkStatus(invoiceId);

    assert.equal(result.status, "PAID");
    assert.equal(result.invoiceId, invoiceId);
    assert.equal(result.providerPaymentId, "sipay-txn-001");
  });

  it("payment_status=0 → NOT_PAID", async () => {
    const invoiceId = "SI-HTTP-CS-NOTPAID";

    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/api/checkstatus")) return makeResponse(checkStatusNotPaidResponse(invoiceId));
      throw new Error(`Unexpected: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = await createSipayProvider().checkStatus(invoiceId);

    assert.equal(result.status, "NOT_PAID");
  });

  it("status_code=69 (PENDING) → PENDING (settle bekleniyor)", async () => {
    const invoiceId = "SI-HTTP-CS-PEND";

    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/api/checkstatus")) return makeResponse(checkStatusPendingResponse(invoiceId));
      throw new Error(`Unexpected: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = await createSipayProvider().checkStatus(invoiceId);

    // status_code 69 — ödeme alındı ama settle henüz tamamlanmadı
    assert.equal(result.status, "PENDING");
  });
});

describe("sipay-http — verifyReturn (hash tabanlı, HTTP yok)", () => {
  before(() => {
    setEnv();
  });

  after(() => {
    clearEnv();
  });

  it("geçerli return hash'i doğrular", async () => {
    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();

    const invoiceId = "SI-HTTP-RET-001";
    const hashKey = _testEncrypt(
      buildReturnHashPlaintext({ invoiceId, merchantKey: MERCHANT_KEY }),
      APP_SECRET,
    );

    const { createSipayProvider } = await import("./sipay-provider");
    const result = createSipayProvider().verifyReturn({ invoice_id: invoiceId, hash_key: hashKey });

    assert.equal(result.valid, true);
    assert.equal(result.invoiceId, invoiceId);
  });

  it("yanlış hash → valid=false", async () => {
    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();

    const invoiceId = "SI-HTTP-RET-002";
    const hashKey = _testEncrypt(`${invoiceId}WRONG_MERCHANT_KEY`, APP_SECRET);

    const { createSipayProvider } = await import("./sipay-provider");
    const result = createSipayProvider().verifyReturn({ invoice_id: invoiceId, hash_key: hashKey });

    assert.equal(result.valid, false);
  });

  it("hash_key eksik → valid=false", async () => {
    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = createSipayProvider().verifyReturn({ invoice_id: "SI-HTTP-RET-003" });

    assert.equal(result.valid, false);
  });
});

describe("sipay-http — refund (mock fetch)", () => {
  before(() => {
    setEnv();
    setupFetchMock();
  });

  after(() => {
    restoreFetch();
    clearEnv();
  });

  it("başarılı iade → SUCCEEDED", async () => {
    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/api/refund")) return makeResponse(refundSuccessResponse());
      throw new Error(`Unexpected: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = await createSipayProvider().refund({
      invoiceId: "SI-HTTP-REFUND-001",
      amountMinor: 5000,
      referenceNo: "REF-001",
    });

    assert.equal(result.status, "SUCCEEDED");
    assert.equal(result.referenceNo, "REF-001");
  });

  it("başarısız iade → FAILED", async () => {
    mockFetch(async (url) => {
      if (url.includes("/ccpayment/api/token")) return makeResponse(tokenResponse());
      if (url.includes("/ccpayment/api/refund")) return makeResponse(refundFailedResponse());
      throw new Error(`Unexpected: ${url}`);
    });

    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    const { _resetTokenCache } = await import("./sipay-token-service");
    _resetTokenCache();

    const { createSipayProvider } = await import("./sipay-provider");
    const result = await createSipayProvider().refund({
      invoiceId: "SI-HTTP-REFUND-FAIL",
      amountMinor: 5000,
      referenceNo: "REF-FAIL",
    });

    assert.equal(result.status, "FAILED");
  });
});

describe("sipay-http — sipayPost client güvenliği", () => {
  before(() => setupFetchMock());
  after(() => restoreFetch());

  it("allowlist dışı URL isteği bloklar", async () => {
    const { sipayPost } = await import("./sipay-client");
    await assert.rejects(
      () => sipayPost("https://evil.example.com", "/pay", {}, "token"),
      /allowlist|geçersiz/i,
    );
  });

  it("HTTP 500 → SipayNetworkError", async () => {
    mockFetch(async () => makeResponse({ error: "server error" }, 500));
    const { sipayPost } = await import("./sipay-client");
    await assert.rejects(
      () =>
        sipayPost(
          "https://provisioning.sipay.com.tr/ccpayment",
          "/api/checkstatus",
          {},
          "token",
        ),
      /HTTP 500/,
    );
  });

  it("non-JSON yanıt → SipayNetworkError", async () => {
    mockFetch(async () => new Response("NOT JSON", { status: 200, headers: { "Content-Type": "text/html" } }));
    const { sipayPost } = await import("./sipay-client");
    await assert.rejects(
      () =>
        sipayPost(
          "https://provisioning.sipay.com.tr/ccpayment",
          "/api/checkstatus",
          {},
          "token",
        ),
      /non-JSON/i,
    );
  });
});
