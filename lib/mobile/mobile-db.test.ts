/**
 * Mobile auth gercek PostgreSQL entegrasyon testleri.
 * TEST_DATABASE_URL env set edilmisse calisir, yoksa skip eder.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL;
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: mobile DB integration tests require TEST_DATABASE_URL or DATABASE_URL";

describe("mobile DB entegrasyon testleri", { skip: SKIP_REASON }, async () => {
  let db: PrismaClient;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();
  });

  after(async () => {
    await db.mobileSession.deleteMany({ where: { deviceInfo: "TEST_MOBILE_INTEGRATION" } });
    await db.companyUser.deleteMany({
      where: { user: { email: { endsWith: "@mobile-test.internal" } } },
    });
    await db.user.deleteMany({ where: { email: { endsWith: "@mobile-test.internal" } } });
    await db.company.deleteMany({ where: { name: { startsWith: "TestMobile_" } } });
    await db.$disconnect();
  });

  async function createTestUser(overrides: {
    status?: "ACTIVE" | "SUSPENDED" | "PASSIVE";
    role?: "OWNER" | "ADMIN" | "ACCOUNTANT" | "STAFF" | "POS_STAFF";
    sessionVersion?: number;
  } = {}) {
    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    return db.user.create({
      data: {
        email: `user-${Date.now()}-${Math.random().toString(36).slice(2)}@mobile-test.internal`,
        password: hash,
        name: "Test Kullanici",
        role: overrides.role ?? "OWNER",
        status: overrides.status ?? "ACTIVE",
        sessionVersion: overrides.sessionVersion ?? 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
  }

  async function createTestCompany(userId: string, role: "OWNER" | "ADMIN" | "STAFF" = "OWNER") {
    const company = await db.company.create({
      data: { name: `TestMobile_${Date.now()}`, status: "ACTIVE" },
    });
    const membership = await db.companyUser.create({
      data: {
        userId,
        companyId: company.id,
        role,
        status: "ACTIVE",
        isOwner: role === "OWNER",
      },
    });
    return { company, membership };
  }

  it("createMobileSession tokenHash kaydeder, raw token kaydetmez", async () => {
    const { createMobileSession } = await import("./mobile-session-service.js");
    const { createHash } = await import("crypto");
    const user = await createTestUser();
    const result = await createMobileSession(user.id, null, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");

    const session = await db.mobileSession.findFirst({
      where: { userId: user.id, deviceInfo: "TEST_MOBILE_INTEGRATION" },
    });
    assert.ok(session, "Session DB'de olmali");
    assert.notEqual(session!.tokenHash, result.refreshToken, "Raw token DB'de olmamali");
    const expected = createHash("sha256").update(result.refreshToken).digest("hex");
    assert.equal(session!.tokenHash, expected, "SHA-256 hash eslesmeli");
  });

  it("access token sid claim session.id ile eslesiyor", async () => {
    const jwt = await import("jsonwebtoken");
    const { createMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser();
    const result = await createMobileSession(user.id, null, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");
    const decoded = jwt.default.decode(result.accessToken) as Record<string, unknown>;
    assert.equal(decoded.sid, result.sessionId, "sid session.id ile eslesmeli");
  });

  it("logout sonrasi access token hemen reddedilir (sid live check)", async () => {
    const { createMobileSession, revokeMobileSessionById } = await import("./mobile-session-service.js");
    const { requireMobileApiSession } = await import("./mobile-auth-guards.js");
    const user = await createTestUser();
    const { company } = await createTestCompany(user.id);
    const result = await createMobileSession(user.id, company.id, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");
    await revokeMobileSessionById(result.sessionId);
    const req = new Request("http://localhost/api/mobile/auth/me", {
      headers: { Authorization: `Bearer ${result.accessToken}` },
    });
    await assert.rejects(() => requireMobileApiSession(req));
  });

  it("paralel refresh — yalniz biri basarili", async () => {
    const { createMobileSession, refreshMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser();
    const result = await createMobileSession(user.id, null, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");
    const [r1, r2] = await Promise.allSettled([
      refreshMobileSession(result.refreshToken),
      refreshMobileSession(result.refreshToken),
    ]);
    const successes = [r1, r2].filter((r) => r.status === "fulfilled");
    const failures = [r1, r2].filter((r) => r.status === "rejected");
    assert.equal(successes.length, 1, "Yalniz biri basarili olmali");
    assert.equal(failures.length, 1, "Biri reddedilmeli");
    const reason = (failures[0] as PromiseRejectedResult).reason as Error;
    assert.equal(reason.message, "INVALID_REFRESH_TOKEN");
  });

  it("revoke edilmis refresh token reddedilir (replay)", async () => {
    const { createMobileSession, revokeMobileSession, refreshMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser();
    const result = await createMobileSession(user.id, null, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");
    await revokeMobileSession(result.refreshToken);
    await assert.rejects(
      () => refreshMobileSession(result.refreshToken),
      (err: Error) => err.message === "INVALID_REFRESH_TOKEN"
    );
  });

  it("suresi dolmus refresh token reddedilir", async () => {
    const { createHash, randomBytes } = await import("crypto");
    const { refreshMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser();
    const expiredToken = randomBytes(48).toString("hex");
    await db.mobileSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
        expiresAt: new Date(Date.now() - 1000),
        deviceInfo: "TEST_MOBILE_INTEGRATION",
      },
    });
    await assert.rejects(
      () => refreshMobileSession(expiredToken),
      (err: Error) => err.message === "INVALID_REFRESH_TOKEN"
    );
  });

  it("suspended user refresh yapamaz", async () => {
    const { createHash, randomBytes } = await import("crypto");
    const { refreshMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser({ status: "SUSPENDED" });
    const token = randomBytes(48).toString("hex");
    await db.mobileSession.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 99999999),
        deviceInfo: "TEST_MOBILE_INTEGRATION",
      },
    });
    await assert.rejects(
      () => refreshMobileSession(token),
      (err: Error) => err.message === "USER_SUSPENDED"
    );
  });

  it("sessionVersion mismatch refresh reddeder", async () => {
    const { createMobileSession, refreshMobileSession } = await import("./mobile-session-service.js");
    const user = await createTestUser({ sessionVersion: 1 });
    const result = await createMobileSession(user.id, null, 1, user.email, "OWNER", "TEST_MOBILE_INTEGRATION");
    await db.user.update({ where: { id: user.id }, data: { sessionVersion: 2 } });
    await assert.rejects(
      () => refreshMobileSession(result.refreshToken),
      (err: Error) => err.message === "SESSION_VERSION_MISMATCH"
    );
  });

  it("company isolation — baska kullanici firma seceemez", async () => {
    const { requireMobileCompanyContext } = await import("./mobile-auth-guards.js");
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const userA = await createTestUser();
    const userB = await createTestUser();
    const { company } = await createTestCompany(userA.id);
    const tokenB = signMobileAccessToken({
      userId: userB.id, email: userB.email, role: "OWNER", companyId: company.id, sv: 1, sid: "fake",
    });
    const sessionB = verifyMobileAccessToken(tokenB)!;
    await assert.rejects(
      () => requireMobileCompanyContext(sessionB, company.id),
      (err: Error) => (err as { code?: string }).code === "COMPANY_NOT_FOUND"
    );
  });

  it("permission guard — STAFF invoice silemez", async () => {
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const { requireMobilePermission } = await import("./mobile-auth-guards.js");
    const user = await createTestUser({ role: "STAFF" });
    const { company } = await createTestCompany(user.id, "STAFF");
    const token = signMobileAccessToken({
      userId: user.id, email: user.email, role: "STAFF", companyId: company.id, sv: 1, sid: "fake",
    });
    const session = verifyMobileAccessToken(token)!;
    await assert.rejects(
      () => requireMobilePermission(session, "invoices", "delete"),
      (err: Error) => (err as { code?: string }).code === "FORBIDDEN"
    );
  });

  it("permission guard — OWNER invoice silebilir", async () => {
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const { requireMobilePermission } = await import("./mobile-auth-guards.js");
    const user = await createTestUser({ role: "OWNER" });
    const { company } = await createTestCompany(user.id, "OWNER");
    const token = signMobileAccessToken({
      userId: user.id, email: user.email, role: "OWNER", companyId: company.id, sv: 1, sid: "fake",
    });
    const session = verifyMobileAccessToken(token)!;
    const result = await requireMobilePermission(session, "invoices", "delete");
    assert.equal(result.role, "OWNER");
    assert.equal(result.isOwner, true);
  });

  it("login rate limit — 10 denemeden sonra bloklanir", async () => {
    const { checkRateLimitAsync } = await import("@/lib/rate-limit");
    const key = `mobile-login:127.0.0.1:ratelimit-${Date.now()}@test.com`;
    for (let i = 0; i < 10; i++) {
      await checkRateLimitAsync({ key, limit: 10, windowMs: 60_000 });
    }
    const result = await checkRateLimitAsync({ key, limit: 10, windowMs: 60_000 });
    assert.equal(result.allowed, false, "11. deneme bloklanmali");
    assert.ok("retryAfterSec" in result, "retryAfterSec donmeli");
  });

  it("membership kaldirilinca firma context alinamaz", async () => {
    const { requireMobileCompanyContext } = await import("./mobile-auth-guards.js");
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const user = await createTestUser();
    const { company, membership } = await createTestCompany(user.id);
    const token = signMobileAccessToken({
      userId: user.id, email: user.email, role: "OWNER", companyId: company.id, sv: 1, sid: "fake",
    });
    const session = verifyMobileAccessToken(token)!;
    await db.companyUser.update({ where: { id: membership.id }, data: { status: "PASSIVE" } });
    await assert.rejects(
      () => requireMobileCompanyContext(session, company.id),
      (err: Error) => (err as { code?: string }).code === "COMPANY_NOT_FOUND"
    );
  });
});

// ── DB olmadan mimarisi testleri ─────────────────────────────────────────
describe("mobile permission matrisi (birim)", () => {
  it("requireMobilePermission export edilir", async () => {
    const { requireMobilePermission } = await import("./mobile-auth-guards.js");
    assert.ok(typeof requireMobilePermission === "function");
  });

  it("revokeMobileSessionById export edilir", async () => {
    const { revokeMobileSessionById } = await import("./mobile-session-service.js");
    assert.ok(typeof revokeMobileSessionById === "function");
  });

  it("SUPER_ADMIN requireMobilePermission'da reddedilir", async () => {
    const { signMobileAccessToken, verifyMobileAccessToken } = await import("./mobile-jwt.js");
    const { requireMobilePermission, MobileAuthError } = await import("./mobile-auth-guards.js");
    const token = signMobileAccessToken({
      userId: "u1", email: "sa@sa.com", role: "SUPER_ADMIN", companyId: "c1", sv: 1, sid: "s1",
    });
    const session = verifyMobileAccessToken(token)!;
    await assert.rejects(
      () => requireMobilePermission(session, "dashboard", "read"),
      (err: Error) => (err as { code?: string }).code === "FORBIDDEN"
    );
  });
});
