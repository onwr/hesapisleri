/**
 * Paylaşılan abonelik (shared entitlement) — GERÇEK PostgreSQL DB integration
 * testleri. Kaynak tarama DEĞİLDİR. TEST_DATABASE_URL yoksa kontrollü skip.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: shared entitlement DB integration tests require TEST_DATABASE_URL pointing to a _test database";

describe("resolveUserCompanyEntitlement / assertCanManageActiveCompanyBilling — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let userAId: string;
  let userStrangerId: string;
  let companyAId: string;
  let companyBId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `shared-ent-${Date.now()}`;

    const userA = await db.user.create({
      data: { email: `${stamp}-a@qa.internal`, password: hash, name: "Shared Ent User A", role: "OWNER", status: "ACTIVE" },
    });
    userAId = userA.id;
    userIds.push(userA.id);

    const stranger = await db.user.create({
      data: { email: `${stamp}-stranger@qa.internal`, password: hash, name: "Shared Ent Stranger", role: "OWNER", status: "ACTIVE" },
    });
    userStrangerId = stranger.id;
    userIds.push(stranger.id);

    const companyA = await db.company.create({ data: { name: `Shared Ent Co A ${stamp}`, status: "ACTIVE" } });
    companyAId = companyA.id;
    companyIds.push(companyA.id);

    const companyB = await db.company.create({ data: { name: `Shared Ent Co B ${stamp}`, status: "ACTIVE" } });
    companyBId = companyB.id;
    companyIds.push(companyB.id);

    // User A her iki şirkette de yetkili (ACTIVE CompanyUser).
    await db.companyUser.create({ data: { userId: userAId, companyId: companyAId, role: "OWNER", isOwner: true, status: "ACTIVE" } });
    await db.companyUser.create({ data: { userId: userAId, companyId: companyBId, role: "OWNER", isOwner: true, status: "ACTIVE" } });

    // Aktif ücretli subscription YALNIZ Company A'da; period 1 yıl ileride bitiyor.
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    await db.companySubscription.create({
      data: {
        companyId: companyAId,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: future,
      },
    });
    // Company B'nin kendi aboneliği yok (bootstrap edilmemiş durumu simüle etmek
    // için oluşturulan olası TRIAL kaydını sil).
    await db.companySubscription.deleteMany({ where: { companyId: companyBId } });
  });

  after(async () => {
    await db.companySubscription.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("Company B seçiliyken: shared entitlement çözülür, sourceCompanyId=A, activeCompanyId=B, isSharedEntitlement=true, canManageBilling=false", async () => {
    const { resolveUserCompanyEntitlement } = await import("./membership-service");
    const entitlement = await resolveUserCompanyEntitlement({ userId: userAId, companyId: companyBId });

    assert.equal(entitlement.sourceCompanyId, companyAId);
    assert.equal(entitlement.activeCompanyId, companyBId);
    assert.equal(entitlement.isSharedEntitlement, true);
    assert.equal(entitlement.canManageBilling, false);
  });

  it("Company B'de tüm billing mutation guard'ları 403 döner", async () => {
    const { assertCanManageActiveCompanyBilling, BillingOwnershipError } = await import("./membership-service");
    await assert.rejects(
      () => assertCanManageActiveCompanyBilling({ userId: userAId, activeCompanyId: companyBId }),
      (err: unknown) => {
        assert.ok(err instanceof BillingOwnershipError);
        assert.equal((err as any).status, 403);
        return true;
      }
    );
  });

  it("Company A seçiliyken: canManageBilling=true, guard geçer", async () => {
    const { resolveUserCompanyEntitlement, assertCanManageActiveCompanyBilling } = await import("./membership-service");
    const entitlement = await resolveUserCompanyEntitlement({ userId: userAId, companyId: companyAId });
    assert.equal(entitlement.canManageBilling, true);
    assert.equal(entitlement.isSharedEntitlement, false);
    assert.equal(entitlement.sourceCompanyId, companyAId);

    const guardResult = await assertCanManageActiveCompanyBilling({ userId: userAId, activeCompanyId: companyAId });
    assert.equal(guardResult.canManageBilling, true);
  });

  it("başka kullanıcı (Company A'da CompanyUser değil) Company A aboneliğini kullanamaz — kendi firması için normal bootstrap'e düşer", async () => {
    const { resolveUserCompanyEntitlement } = await import("./membership-service");
    const stampCo = await db.company.create({ data: { name: `Stranger Co ${Date.now()}`, status: "ACTIVE" } });
    companyIds.push(stampCo.id);
    await db.companyUser.create({ data: { userId: userStrangerId, companyId: stampCo.id, role: "OWNER", isOwner: true, status: "ACTIVE" } });

    const entitlement = await resolveUserCompanyEntitlement({ userId: userStrangerId, companyId: stampCo.id });
    assert.notEqual(entitlement.sourceCompanyId, companyAId, "yabancı kullanıcı Company A'nın aboneliğini asla kullanamaz");
    assert.equal(entitlement.activeCompanyId, stampCo.id);
  });

  it("expired subscription paylaşılan entitlement üretmez", async () => {
    const { resolveUserCompanyEntitlement } = await import("./membership-service");

    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    await db.companySubscription.update({
      where: { companyId: companyAId },
      data: { currentPeriodEnd: past, status: "ACTIVE" },
    });

    try {
      const entitlement = await resolveUserCompanyEntitlement({ userId: userAId, companyId: companyBId });
      const { getMembershipStatus } = await import("./membership-utils");
      assert.equal(
        getMembershipStatus(entitlement.subscription),
        "EXPIRED",
        "expired abonelik kullanılabilir/aktif gibi paylaşılmamalı"
      );
      assert.equal(entitlement.isSharedEntitlement, false);
      assert.equal(entitlement.canManageBilling, false);
    } finally {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      await db.companySubscription.update({
        where: { companyId: companyAId },
        data: { currentPeriodEnd: future },
      });
    }
  });

  it("cancelled subscription paylaşılan entitlement üretmez", async () => {
    const { resolveUserCompanyEntitlement } = await import("./membership-service");

    await db.companySubscription.update({
      where: { companyId: companyAId },
      data: { status: "CANCELLED" },
    });

    try {
      const entitlement = await resolveUserCompanyEntitlement({ userId: userAId, companyId: companyBId });
      assert.equal(entitlement.isSharedEntitlement, false, "cancelled abonelik aktif paylaşım gibi işaretlenmemeli");
      assert.equal(entitlement.canManageBilling, false);
    } finally {
      await db.companySubscription.update({
        where: { companyId: companyAId },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("kullanıcının aboneliği bitmişse (tüm firmalarda EXPIRED), YENİ oluşturduğu bir firma da TRIAL bootstrap ALMAZ — panel kısıtlı başlar", async () => {
    const { resolveUserCompanyEntitlement } = await import("./membership-service");

    // Company A'nın aboneliğini bitir (EXPIRED).
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    await db.companySubscription.update({
      where: { companyId: companyAId },
      data: { currentPeriodEnd: past, status: "ACTIVE" },
    });

    // Kullanıcı A yepyeni bir firma oluşturuyor (hiç CompanySubscription kaydı yok).
    const brandNewCo = await db.company.create({ data: { name: `Brand New Co ${Date.now()}`, status: "ACTIVE" } });
    companyIds.push(brandNewCo.id);
    await db.companyUser.create({ data: { userId: userAId, companyId: brandNewCo.id, role: "OWNER", isOwner: true, status: "ACTIVE" } });

    try {
      const entitlement = await resolveUserCompanyEntitlement({ userId: userAId, companyId: brandNewCo.id });

      // Yeni firma için hiçbir CompanySubscription satırı OLUŞTURULMAMALI.
      const created = await db.companySubscription.findUnique({ where: { companyId: brandNewCo.id } });
      assert.equal(created, null, "bitmiş kullanıcı için yeni firmaya TRIAL bootstrap edilmemeli");

      assert.equal(entitlement.canManageBilling, false);
      const { getMembershipStatus } = await import("./membership-utils");
      assert.equal(getMembershipStatus(entitlement.subscription), "EXPIRED");
    } finally {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      await db.companySubscription.update({
        where: { companyId: companyAId },
        data: { currentPeriodEnd: future },
      });
    }
  });
});
