import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createCsrfOriginRejectedResponse,
  getAllowedMutationOrigins,
  isAllowedMutationOrigin,
  isMutationHttpMethod,
  isBearerOnlyApiPath,
  isMutationOriginExemptPath,
  shouldRejectUntrustedMutation,
  verifyApiMutationOrigin,
} from "./api-origin-guard";

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("api-origin-guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.WEBSITE_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("APP_URL origin izin listesine dahil edilir", () => {
    process.env.APP_URL = "https://hesapisleri.com";
    process.env.SIPAY_RETURN_URL =
      "https://hesapisleri.com/api/billing/sipay/return";

    const allowed = getAllowedMutationOrigins();
    assert.ok(allowed.includes("https://hesapisleri.com"));
    assert.equal(
      isAllowedMutationOrigin("https://hesapisleri.com", null),
      true,
    );
  });

  it("SIPAY_RETURN_URL origin APP_URL olmadan da izin verir", () => {
    delete process.env.APP_URL;
    process.env.SIPAY_RETURN_URL =
      "https://hesapisleri.com/api/billing/sipay/return";

    assert.equal(
      isAllowedMutationOrigin(null, "https://hesapisleri.com/settings/billing/payment/sipay-result"),
      true,
    );
  });

  it("mutation HTTP metodlarını tanır", () => {
    assert.equal(isMutationHttpMethod("POST"), true);
    assert.equal(isMutationHttpMethod("get"), false);
  });

  it("verifyApiMutationOrigin kötü origin için 403 döner", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    const req = new Request("https://hesapisleri.com/api/products", {
      method: "POST",
      headers: { origin: "https://attacker.test" },
    });
    const res = verifyApiMutationOrigin(req);
    assert.ok(res);
    assert.equal(res?.status, 403);

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("createCsrfOriginRejectedResponse Türkçe mesaj döner", async () => {
    const res = createCsrfOriginRejectedResponse();
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.message, /doğrulanamadı/i);
    assert.equal(body.code, "CSRF_ORIGIN_REJECTED");
  });

  it("istisna path'lerde shouldRejectUntrustedMutation false", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.MUTATION_ORIGIN_GUARD_DISABLED = undefined;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/webhooks/sipay",
        origin: null,
        referer: null,
        authorization: null,
      }),
      false
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("sahte Bearer web route'u bypass edemez", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.MUTATION_ORIGIN_GUARD_DISABLED = undefined;
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/products/bulk",
        origin: "https://evil.example",
        referer: null,
        authorization: "Bearer fake",
      }),
      true
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });
});
