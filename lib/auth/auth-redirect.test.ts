import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClearSessionUrl,
  sanitizeAuthRedirectPath,
} from "./auth-redirect";

describe("sanitizeAuthRedirectPath", () => {
  it("güvenli internal path kabul eder", () => {
    assert.equal(sanitizeAuthRedirectPath("/sales"), "/sales");
    assert.equal(
      sanitizeAuthRedirectPath("/invite?token=abc123"),
      "/invite?token=abc123"
    );
  });

  it("external redirect engellenir", () => {
    assert.equal(sanitizeAuthRedirectPath("https://evil.com"), "/dashboard");
    assert.equal(sanitizeAuthRedirectPath("//evil.com/path"), "/dashboard");
  });

  it("auth route hedefleri reddedilir", () => {
    assert.equal(sanitizeAuthRedirectPath("/login"), "/dashboard");
    assert.equal(sanitizeAuthRedirectPath("/register"), "/dashboard");
    assert.equal(sanitizeAuthRedirectPath("/api/auth/login"), "/dashboard");
  });

  it("boş değer fallback döner", () => {
    assert.equal(sanitizeAuthRedirectPath(""), "/dashboard");
    assert.equal(sanitizeAuthRedirectPath(null), "/dashboard");
  });
});

describe("buildSessionExpiredLoginUrl", () => {
  it("doğrudan login URL üretir", () => {
    assert.equal(
      buildClearSessionUrl("/login?reason=session-expired"),
      "/login?reason=session-expired"
    );
  });
});
