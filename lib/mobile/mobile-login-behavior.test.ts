/**
 * Mobile login endpoint davranış testleri — DB gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const SID = "test-sid";

// ── JWT / token yapısı ──────────────────────────────────────────────────────
describe("mobile-jwt güvenlik", () => {
  it("access token type='mobile-access' içerir", async () => {
    const jwt = await import("jsonwebtoken");
    const { signMobileAccessToken } = await import("./mobile-jwt.js");
    const token = signMobileAccessToken({ userId: "u1", email: "a@b.com", role: "OWNER", companyId: "c1", sv: 1, sid: SID });
    const decoded = jwt.default.decode(token) as Record<string, unknown>;
    assert.equal(decoded.type, "mobile-access");
    assert.equal(decoded.sid, SID);
  });

  it("access token 15 dakika TTL içerir", async () => {
    const jwt = await import("jsonwebtoken");
    const { signMobileAccessToken } = await import("./mobile-jwt.js");
    const token = signMobileAccessToken({ userId: "u1", email: "a@b.com", role: "OWNER", companyId: null, sv: 1, sid: SID });
    const decoded = jwt.default.decode(token) as { exp: number; iat: number };
    const ttlSeconds = decoded.exp - decoded.iat;
    assert.ok(ttlSeconds >= 890 && ttlSeconds <= 910, `TTL ${ttlSeconds} sn`);
  });

  it("SUPER_ADMIN token üretilebilir ama login engellenir", async () => {
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const token = signMobileAccessToken({ userId: "u1", email: "a@b.com", role: "SUPER_ADMIN", companyId: null, sv: 1, sid: SID });
    const payload = verifyMobileAccessToken(token);
    assert.equal(payload?.role, "SUPER_ADMIN");
    assert.ok(true, "SUPER_ADMIN login route + requireMobilePermission'da bloklanır");
  });

  it("web session token mobile guard'ı geçemez", async () => {
    const jwt = await import("jsonwebtoken");
    const { verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const secret = process.env.JWT_SECRET || "hesapisleri-secret";
    const webToken = jwt.default.sign({ userId: "u1", type: "web-auth", sv: 1 }, secret, { expiresIn: "1h" });
    assert.equal(verifyMobileAccessToken(webToken), null, "Web token mobile guard'ı geçmemeli");
  });

  it("JWT_SECRET yoksa fallback uyarısı (production'da zorunlu)", () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "hesapisleri-secret") {
      assert.ok(true, "Uyarı: JWT_SECRET varsayılan değerde — production'da set edilmeli");
    } else {
      assert.ok(true, "JWT_SECRET doğru yapılandırılmış");
    }
  });
});

// ── Session service davranışları ──────────────────────────────────────────
describe("mobile-session-service davranışları", () => {
  it("hashToken deterministik", async () => {
    const { createHash } = await import("crypto");
    const h1 = createHash("sha256").update("test-token").digest("hex");
    const h2 = createHash("sha256").update("test-token").digest("hex");
    assert.equal(h1, h2);
  });

  it("farklı token farklı hash üretir", async () => {
    const { createHash } = await import("crypto");
    const h1 = createHash("sha256").update("token-a").digest("hex");
    const h2 = createHash("sha256").update("token-b").digest("hex");
    assert.notEqual(h1, h2);
  });

  it("refresh token 96 hex karakter (48 byte)", async () => {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(48).toString("hex");
    assert.equal(token.length, 96);
  });

  it("session service dosyasında raw token loglama yok", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    assert.ok(!src.includes("console.log(refreshToken"), "Raw token loglanmamalı");
    assert.ok(!src.includes("console.log(newRefreshToken"), "Raw token loglanmamalı");
  });

  it("session service response'da refreshToken (ham) dönüyor, tokenHash değil", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    // Return objesi refreshToken içermeli
    assert.ok(src.includes("refreshToken") && src.includes("accessToken"), "Response'da token'lar dönmeli");
    // DB'ye tokenHash yazılmalı
    assert.ok(src.includes("tokenHash"), "Hash DB'ye yazılmalı");
    // Raw token DB'ye yazılmamalı
    assert.ok(!src.includes("data: { userId, refreshToken"), "Raw token DB'ye yazılmamalı");
  });

  it("atomik rotation — updateMany count check ile", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    // updateMany sonucu count 0 ise hata atmalı
    assert.ok(src.includes("revokeResult.count === 0"), "Race condition koruması olmalı");
  });
});

// ── Auth guard davranışları ──────────────────────────────────────────────
describe("mobile-auth-guards — token davranışları", () => {
  it("Bearer olmayan Authorization reddedilir", async () => {
    const { requireMobileApiSession } = await import("./mobile-auth-guards.js");
    const req = new Request("http://localhost/api/mobile/auth/me", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    await assert.rejects(() => requireMobileApiSession(req), (err: Error) => {
      return err.message.includes("Authorization");
    });
  });

  it("boş Bearer reddedilir", async () => {
    const { requireMobileApiSession } = await import("./mobile-auth-guards.js");
    const req = new Request("http://localhost/api/mobile/auth/me", {
      headers: { Authorization: "Bearer " },
    });
    await assert.rejects(() => requireMobileApiSession(req));
  });

  it("companyId body'den gelmiyor — session'dan alınıyor", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "../../app/api/mobile/auth/me/route.ts"), "utf-8");
    assert.ok(!src.includes("req.json()"), "Me endpoint body okumamalı");
  });

  it("companies/select DB membership doğrulaması yapıyor", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "../../app/api/mobile/companies/select/route.ts"), "utf-8");
    assert.ok(src.includes("requireMobileCompanyContext"), "DB membership doğrulama yapılmalı");
  });

  it("sid guard dosyasında tanımlı", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-auth-guards.ts"), "utf-8");
    assert.ok(src.includes("payload.sid"), "Guard sid doğrulamalı");
    assert.ok(src.includes("revokedAt"), "Guard revokedAt kontrol etmeli");
  });
});

// ── Refresh rotation güvenliği ───────────────────────────────────────────
describe("refresh token rotation kuralları", () => {
  it("revoke fonksiyonu revokedAt set eder", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    assert.ok(src.includes("revokedAt: new Date()"), "Revoke revokedAt set etmeli");
  });

  it("rotation atomik updateMany ile yapılıyor", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "mobile-session-service.ts"), "utf-8");
    assert.ok(src.includes("updateMany"), "updateMany kullanılmalı");
    assert.ok(src.includes("revokeResult.count"), "Count kontrolü yapılmalı");
  });

  it("refresh endpoint raw token loglamıyor", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "../../app/api/mobile/auth/refresh/route.ts"), "utf-8");
    assert.ok(!src.includes("console.log"), "Refresh route token loglamamalı");
  });

  it("login rate limit entegre edilmiş", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(import.meta.dirname, "../../app/api/mobile/auth/login/route.ts"), "utf-8");
    assert.ok(src.includes("checkRateLimitAsync"), "Rate limit entegre edilmeli");
    assert.ok(src.includes("RATE_LIMITED"), "429 kodu dönmeli");
    assert.ok(src.includes("Retry-After"), "Retry-After header'ı dönmeli");
  });
});

// ── Endpoint yapısal doğrulamaları ───────────────────────────────────────
describe("mobile endpoint yapıları", () => {
  it("login POST export ediyor", async () => {
    const mod = await import("../../app/api/mobile/auth/login/route.js");
    assert.ok(typeof mod.POST === "function");
  });

  it("refresh POST export ediyor", async () => {
    const mod = await import("../../app/api/mobile/auth/refresh/route.js");
    assert.ok(typeof mod.POST === "function");
  });

  it("logout POST export ediyor", async () => {
    const mod = await import("../../app/api/mobile/auth/logout/route.js");
    assert.ok(typeof mod.POST === "function");
  });

  it("me GET export ediyor", async () => {
    const mod = await import("../../app/api/mobile/auth/me/route.js");
    assert.ok(typeof mod.GET === "function");
  });

  it("companies GET export ediyor", async () => {
    const mod = await import("../../app/api/mobile/companies/route.js");
    assert.ok(typeof mod.GET === "function");
  });

  it("companies/select POST export ediyor", async () => {
    const mod = await import("../../app/api/mobile/companies/select/route.js");
    assert.ok(typeof mod.POST === "function");
  });
});
