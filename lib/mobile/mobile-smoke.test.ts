import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB = process.env.DATABASE_URL ?? "";
const SKIP = !TEST_DB.includes("hesapisleri_test");

describe("MobileSession sıfırdan migration smoke testi", { skip: SKIP }, async () => {
  let db: PrismaClient;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB } } });
    await db.$connect();
  });

  after(async () => {
    await db.mobileSession.deleteMany({ where: { deviceInfo: "smoke-migration-test" } });
    await db.user.deleteMany({ where: { email: "smoke@mobile-test.internal" } });
    await db.$disconnect();
  });

  it("MobileSession tablosu mevcut ve sessionVersion sütunu var", async () => {
    const { PrismaClient: PC } = await import("@prisma/client");
    const raw = new PC({ datasources: { db: { url: TEST_DB } } });
    const cols = await raw.$queryRaw<{ column_name: string; data_type: string; column_default: string | null }[]>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'MobileSession'
      ORDER BY ordinal_position
    `;
    await raw.$disconnect();

    const names = cols.map((c) => c.column_name);
    assert.ok(names.includes("sessionVersion"), "sessionVersion sütunu mevcut olmalı");
    assert.ok(names.includes("tokenHash"), "tokenHash sütunu mevcut olmalı");
    assert.ok(names.includes("revokedAt"), "revokedAt sütunu mevcut olmalı");

    const sv = cols.find((c) => c.column_name === "sessionVersion");
    assert.equal(sv?.data_type, "integer", "sessionVersion integer olmalı");
    assert.ok(sv?.column_default?.includes("1"), "DEFAULT 1 olmalı");
  });

  it("pending migration yok — tüm migration'lar uygulanmış", async () => {
    const applied = await db.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at
    `;
    const pending = applied.filter((m) => !m.finished_at && !m.rolled_back_at);
    const failed = applied.filter((m) => !m.finished_at && m.rolled_back_at);
    assert.equal(pending.length, 0, `Pending migration yok olmalı: ${pending.map((m) => m.migration_name).join(", ")}`);
    assert.equal(failed.length, 0, `Failed migration yok olmalı: ${failed.map((m) => m.migration_name).join(", ")}`);
    assert.ok(applied.length >= 63, `En az 63 migration uygulanmış olmalı, bulundu: ${applied.length}`);
  });

  it("add_mobile_session sırasında add_sv migration sonra gelmiş — doğal sıra", async () => {
    const rows = await db.$queryRaw<{ migration_name: string; finished_at: Date }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations
      WHERE migration_name IN (
        '20260715120000_add_mobile_session',
        '20260715130000_mobile_session_add_session_version'
      )
      ORDER BY finished_at
    `;
    assert.equal(rows.length, 2, "Her iki migration mevcut olmalı");
    assert.equal(rows[0].migration_name, "20260715120000_add_mobile_session", "Tablo oluşturma önce gelmiş olmalı");
    assert.equal(rows[1].migration_name, "20260715130000_mobile_session_add_session_version", "sessionVersion sonra eklenmeli");
  });

  it("eski add_sv migration (20260628) mevcut değil", async () => {
    const rows = await db.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name = '20260628100000_mobile_session_add_sv'
    `;
    assert.equal(rows.length, 0, "Eski add_sv migration geçmişte görünmemeli");
  });

  it("User oluştur → MobileSession kaydet → sessionVersion doğrula → revoke", async () => {
    const { createHash, randomBytes } = await import("crypto");
    const { hashPassword } = await import("@/lib/auth");

    const hash = await hashPassword("Test1234!");
    const user = await db.user.create({
      data: {
        email: "smoke@mobile-test.internal",
        password: hash, name: "Smoke",
        role: "OWNER", status: "ACTIVE", sessionVersion: 3,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });

    const token = randomBytes(48).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const session = await db.mobileSession.create({
      data: {
        userId: user.id, tokenHash, sessionVersion: user.sessionVersion,
        expiresAt: new Date(Date.now() + 86400000), deviceInfo: "smoke-migration-test",
      },
    });

    assert.equal(session.sessionVersion, 3, "sessionVersion user.sessionVersion ile eşleşmeli");
    assert.equal(session.tokenHash, tokenHash, "tokenHash SHA-256 hash olmalı");
    assert.equal(session.tokenHash.length, 64, "SHA-256 hex 64 karakter");
    assert.ok(session.revokedAt === null, "Yeni session revoke edilmemiş olmalı");

    // Revoke
    const rv = await db.mobileSession.updateMany({
      where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() },
    });
    assert.equal(rv.count, 1, "Tam 1 session revoke edilmeli");

    // Replay — aynı token ikinci kez reddedilmeli
    const rv2 = await db.mobileSession.updateMany({
      where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() },
    });
    assert.equal(rv2.count, 0, "Replay saldırısı reddedilmeli (count=0)");
  });
});
