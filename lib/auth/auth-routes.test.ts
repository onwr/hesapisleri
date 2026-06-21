import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuthRoute,
  isCompanySelectionRoute,
  isProtectedRoute,
  isPublicRoute,
} from "./auth-routes";

describe("auth routes", () => {
  it("auth route tanır", () => {
    assert.equal(isAuthRoute("/login"), true);
    assert.equal(isAuthRoute("/register"), true);
    assert.equal(isAuthRoute("/dashboard"), false);
  });

  it("public route tanır", () => {
    assert.equal(isPublicRoute("/"), true);
    assert.equal(isPublicRoute("/pricing"), true);
    assert.equal(isPublicRoute("/kvkk-aydinlatma-metni"), true);
    assert.equal(isProtectedRoute("/kvkk-aydinlatma-metni"), false);
    assert.equal(isProtectedRoute("/dashboard"), true);
  });

  it("company selection route korunmaz", () => {
    assert.equal(isCompanySelectionRoute("/companies/select"), true);
    assert.equal(isProtectedRoute("/companies/select"), false);
  });

  it("auth api route korunmaz", () => {
    assert.equal(isProtectedRoute("/api/auth/login"), false);
    assert.equal(isProtectedRoute("/api/auth/clear-session"), false);
  });
});
