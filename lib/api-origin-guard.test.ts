import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedMutationOrigins,
  isAllowedMutationOrigin,
} from "./api-origin-guard";

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
});
