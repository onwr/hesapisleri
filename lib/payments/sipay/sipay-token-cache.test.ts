import assert from "node:assert/strict";
import { describe, it, before, after, mock } from "node:test";
import { registerDistributedKv, resetDistributedKvForTests } from "@/lib/cache/distributed-kv";
import { resetDistributedKvSingleton } from "@/lib/cache/distributed-kv-factory";
import { createSharedMemoryDistributedKv } from "@/lib/cache/memory-distributed-kv";
import { _clearSipayTokenCache } from "./sipay-token-service";

const APP_SECRET = "test_app_secret_32bytes_padding0";
const MERCHANT_KEY = "merchant_key_32bytes_padding_0000";
const APP_ID = "test-app-id";

function setEnv() {
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
}

describe("sipay token cache — multi-instance stampede", () => {
  const originalFetch = globalThis.fetch;
  let tokenCalls = 0;

  before(() => {
    setEnv();
    tokenCalls = 0;
    const sharedValues = new Map();
    const sharedLocks = new Map();
    resetDistributedKvForTests();
    resetDistributedKvSingleton();
    registerDistributedKv(createSharedMemoryDistributedKv({ values: sharedValues, locks: sharedLocks }));

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/ccpayment/api/token")) {
        tokenCalls += 1;
        return new Response(
          JSON.stringify({
            status_code: 100,
            status_description: "ok",
            data: {
              token: "shared-token",
              is_3d: 4,
              expires_at: new Date(Date.now() + 3_600_000).toISOString(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
    _clearSipayTokenCache();
    resetDistributedKvForTests();
    resetDistributedKvSingleton();
  });

  it("iki paralel instance tek token isteği yapar", async () => {
    const { _resetSipayEnvCache } = await import("./sipay-env");
    _resetSipayEnvCache();
    _clearSipayTokenCache();

    const { getSipayToken } = await import("./sipay-token-service");
    const params = {
      baseUrl: "https://provisioning.sipay.com.tr",
      appId: APP_ID,
      appSecret: APP_SECRET,
      sipayEnv: "test",
    };

    const [a, b] = await Promise.all([getSipayToken(params), getSipayToken(params)]);
    assert.equal(a.token, b.token);
    assert.equal(tokenCalls, 1);
  });
});
