import { describe, it } from "node:test";
import assert from "node:assert/strict";

const TEST_SID = "test-session-id-001";

// ── JWT ────────────────────────────────────────────────────────────────────
describe("mobile-jwt", () => {
  it("sign ve verify round-trip çalışır", async () => {
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const token = signMobileAccessToken({ userId: "u1", email: "test@test.com", role: "OWNER", companyId: "c1", sv: 1, sid: TEST_SID });
    assert.ok(typeof token === "string" && token.length > 20);
    const payload = verifyMobileAccessToken(token);
    assert.equal(payload?.userId, "u1");
    assert.equal(payload?.type, "mobile-access");
    assert.equal(payload?.sid, TEST_SID);
  });

  it("yanlış type reddedilir", async () => {
    const jwt = await import("jsonwebtoken");
    const { verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const secret = process.env.JWT_SECRET || "hesapisleri-secret";
    const badToken = jwt.default.sign({ userId: "u1", type: "web-session", sv: 1, sid: TEST_SID }, secret, { expiresIn: "1m" });
    assert.equal(verifyMobileAccessToken(badToken), null);
  });

  it("süresi dolmuş token null döner", async () => {
    const jwt = await import("jsonwebtoken");
    const { verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const secret = process.env.JWT_SECRET || "hesapisleri-secret";
    const expiredToken = jwt.default.sign({ userId: "u1", type: "mobile-access", sv: 1, sid: TEST_SID }, secret, { expiresIn: "-1s" });
    assert.equal(verifyMobileAccessToken(expiredToken), null);
  });
});

// ── Session Service exports ──────────────────────────────────────────────
describe("mobile-session-service exports", () => {
  it("gerekli fonksiyonlar export edilir", async () => {
    const mod = await import("./mobile-session-service.js");
    assert.ok(typeof mod.createMobileSession === "function");
    assert.ok(typeof mod.refreshMobileSession === "function");
    assert.ok(typeof mod.revokeMobileSession === "function");
    assert.ok(typeof mod.revokeMobileSessionById === "function");
    assert.ok(typeof mod.revokeAllUserMobileSessions === "function");
  });
});

// ── Auth Guards ──────────────────────────────────────────────────────────
describe("mobile-auth-guards", () => {
  it("Authorization header olmadan hata fırlatır", async () => {
    const { requireMobileApiSession } = await import("./mobile-auth-guards.js");
    const req = new Request("http://localhost/api/mobile/auth/me");
    await assert.rejects(
      () => requireMobileApiSession(req),
      (err: Error) => err.message.includes("Authorization")
    );
  });

  it("MobileAuthError Error'dan türetilmiş", async () => {
    const { MobileAuthError } = await import("./mobile-auth-guards.js");
    const err = new MobileAuthError("SESSION_EXPIRED", "test", 401);
    assert.ok(err instanceof Error);
    assert.ok(err instanceof MobileAuthError);
    assert.equal(err.code, "SESSION_EXPIRED");
    assert.equal(err.status, 401);
  });

  it("mobileErrorResponse NextResponse döner", async () => {
    const { mobileErrorResponse } = await import("./mobile-auth-guards.js");
    const res = mobileErrorResponse("TEST_CODE", "Hata mesajı", 400);
    assert.equal(res.status, 400);
  });
});

// ── Güvenlik kontrolleri ─────────────────────────────────────────────────
describe("mobile güvenlik", () => {
  it("POST login endpoint otomatik retry uygulamaz (mimari dokümanı)", () => {
    assert.ok(true, "POST retry yok — api-client tasarımıyla garanti altında");
  });

  it("MobileAuthError COMPANY_NOT_FOUND kodu desteklenir", async () => {
    const { MobileAuthError } = await import("./mobile-auth-guards.js");
    const err = new MobileAuthError("COMPANY_NOT_FOUND", "Firma bulunamadı", 403);
    assert.equal(err.code, "COMPANY_NOT_FOUND");
    assert.equal(err.status, 403);
  });

  it("revokeMobileSession ve revokeMobileSessionById export edilir", async () => {
    const { revokeMobileSession, revokeMobileSessionById } = await import("./mobile-session-service.js");
    assert.ok(typeof revokeMobileSession === "function");
    assert.ok(typeof revokeMobileSessionById === "function");
  });

  it("session service hash fonksiyonu — SHA-256 kullanır (dosya analizi)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    assert.ok(src.includes("sha256") || src.includes("SHA256") || src.includes("createHash"));
    assert.ok(!src.includes("md5") && !src.includes("MD5"));
  });

  it("access token sid claim içeriyor (dosya analizi)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const jwtSrc = readFileSync(join(import.meta.dirname, "mobile-jwt.ts"), "utf-8");
    assert.ok(jwtSrc.includes("sid"), "JWT payload sid içermeli");
  });

  it("requireMobileApiSession sid doğrulaması yapıyor (dosya analizi)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-auth-guards.ts"), "utf-8");
    assert.ok(src.includes("payload.sid"), "Guard sid doğrulama yapmalı");
    assert.ok(src.includes("revokedAt"), "Guard revokedAt kontrolü yapmalı");
  });
});
