import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessModule } from "./permission-utils";

describe("admin access rules", () => {
  it("normal OWNER admin modülüne erişemez", () => {
    assert.equal(canAccessModule("OWNER", "admin"), false);
  });

  it("STAFF şirket rolü olsa bile admin modülüne erişemez", () => {
    assert.equal(canAccessModule("STAFF", "admin"), false);
    assert.equal(canAccessModule("ADMIN", "admin"), false);
    assert.equal(canAccessModule("ACCOUNTANT", "admin"), false);
  });

  it("SUPER_ADMIN admin modülüne erişir", () => {
    assert.equal(canAccessModule("SUPER_ADMIN", "admin"), true);
  });

  it("SUPER_ADMIN tüm modüllere erişir", () => {
    assert.equal(canAccessModule("SUPER_ADMIN", "cash-bank"), true);
    assert.equal(canAccessModule("SUPER_ADMIN", "pos"), true);
    assert.equal(canAccessModule("SUPER_ADMIN", "settings-users"), true);
  });
});
