import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SIPAY_ALLOWED_BASE_URLS, validateReturnUrl } from "./sipay-env";

describe("sipay redirect URL allowlist", () => {
  it("test URL allowlist'te", () => {
    assert.doesNotThrow(() =>
      validateReturnUrl("https://provisioning.sipay.com.tr/some/path"),
    );
  });

  it("live URL allowlist'te", () => {
    assert.doesNotThrow(() => validateReturnUrl("https://app.sipay.com.tr/some/path"));
  });

  it("keyfi domain reddedilir", () => {
    assert.throws(() => validateReturnUrl("https://evil.com/steal"), /allowlist/);
  });

  it("subdomain bypass reddedilir", () => {
    assert.throws(
      () => validateReturnUrl("https://evil.provisioning.sipay.com.tr/steal"),
      /allowlist/,
    );
  });

  it("allowlist array'i 2 eleman içerir", () => {
    assert.equal(SIPAY_ALLOWED_BASE_URLS.length, 2);
  });
});
