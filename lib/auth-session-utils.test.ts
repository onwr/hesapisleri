import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeRedirectPath } from "./redirect-utils";

describe("sanitizeRedirectPath", () => {
  it("internal path kabul eder", () => {
    assert.equal(
      sanitizeRedirectPath("/invite?token=abc123"),
      "/invite?token=abc123"
    );
  });

  it("external redirect engellenir", () => {
    assert.equal(sanitizeRedirectPath("https://evil.com"), null);
    assert.equal(sanitizeRedirectPath("//evil.com/path"), null);
  });

  it("boş değer null döner", () => {
    assert.equal(sanitizeRedirectPath(""), null);
    assert.equal(sanitizeRedirectPath(null), null);
  });
});
