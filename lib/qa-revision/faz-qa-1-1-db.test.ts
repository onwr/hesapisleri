/**
 * QA Faz 1.1 — gerçek PostgreSQL entegrasyon testleri (hesap açılış bakiyesi + arşivleme).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 1.1 — hesap açılış bakiyesi DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const owner = await db.user.create({
      data: {
        email: `qa-owner-${Date.now()}@qa-faz11.internal`,
        password: hash,
        name: "QA Owner",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerAId = owner.id;

    const companyA = await db.company.create({
      data: { name: `TestQA11_A_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `TestQA11_B_${Date.now()}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;

    await db.companyUser.createMany({
      data: [
        {
          userId: ownerAId,
          companyId: companyAId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
        {
          userId: ownerAId,
          companyId: companyBId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
      ],
    });
  });

  after(async () => {
    const companies = await db.company.findMany({
      where: { name: { startsWith: "TestQA11_" } },
      select: { id: true },
    });
    const companyIds = companies.map((c) => c.id);

    if (companyIds.length > 0) {
      await db.accountTransaction.deleteMany({
        where: { account: { companyId: { in: companyIds } } },
      });
      await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.company.deleteMany({ where: { id: { in: companyIds } } });
    }

    await db.user.deleteMany({
      where: { email: { endsWith: "@qa-faz11.internal" } },
    });
    await db.$disconnect();
  });

  async function countAccounts(companyId: string) {
    return db.account.count({ where: { companyId } });
  }

  async function sumBalances(companyId: string) {
    const rows = await db.account.findMany({
      where: { companyId },
      select: { balance: true },
    });
    return rows.reduce((sum, row) => sum + Number(row.balance), 0);
  }

  it("negatif opening balance → 400, hesap ve hareket oluşmaz", async () => {
    const { createCompanyAccount } = await import("@/lib/account-admin-service");
    const beforeCount = await countAccounts(companyAId);
    const beforeTx = await db.accountTransaction.count({
      where: { account: { companyId: companyAId } },
    });
    const beforeBalance = await sumBalances(companyAId);

    const result = await createCompanyAccount(companyAId, ownerAId, {
      name: `Negatif Kasa ${Date.now()}`,
      type: "CASH",
      openingBalance: -250,
    });

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);

    assert.equal(await countAccounts(companyAId), beforeCount);
    assert.equal(
      await db.accountTransaction.count({
        where: { account: { companyId: companyAId } },
      }),
      beforeTx
    );
    assert.equal(await sumBalances(companyAId), beforeBalance);
  });

  it("sıfır açılış bakiyesi kabul edilir, hareket oluşmaz", async () => {
    const { createCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await createCompanyAccount(companyAId, ownerAId, {
      name: `Sıfır Kasa ${Date.now()}`,
      type: "CASH",
      openingBalance: 0,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const accountId = (result.data as { id: string }).id;
    const txCount = await db.accountTransaction.count({
      where: { accountId },
    });
    const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
    assert.equal(txCount, 0);
    assert.equal(Number(account.balance), 0);
  });

  it("pozitif açılış bakiyesi tek INCOME hareketi oluşturur", async () => {
    const { createCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await createCompanyAccount(companyAId, ownerAId, {
      name: `Pozitif Kasa ${Date.now()}`,
      type: "CASH",
      openingBalance: 1500,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const accountId = (result.data as { id: string }).id;
    const transactions = await db.accountTransaction.findMany({
      where: { accountId },
    });
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0]?.type, "INCOME");
    assert.equal(transactions[0]?.title, "Açılış bakiyesi");
    assert.equal(Number(transactions[0]?.amount), 1500);

    const account = await db.account.findUniqueOrThrow({ where: { id: accountId } });
    assert.equal(Number(account.balance), 1500);
  });

  it("foreign company hesap oluşturma izolasyonu korunur", async () => {
    const { createCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await createCompanyAccount(companyBId, ownerAId, {
      name: `B Kasa ${Date.now()}`,
      type: "CASH",
      openingBalance: 100,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const accountId = (result.data as { id: string }).id;
    const foreign = await db.account.findFirst({
      where: { id: accountId, companyId: companyAId },
    });
    assert.equal(foreign, null);
  });
});

describe("QA Faz 1.1 — hesap arşivleme DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;
  let activeAccountId: string;
  let defaultAccountId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const owner = await db.user.create({
      data: {
        email: `qa-archive-${Date.now()}@qa-faz11.internal`,
        password: hash,
        name: "QA Archive Owner",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerAId = owner.id;

    const companyA = await db.company.create({
      data: { name: `TestQA11_ArchiveA_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `TestQA11_ArchiveB_${Date.now()}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;

    await db.companyUser.createMany({
      data: [
        {
          userId: ownerAId,
          companyId: companyAId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
        {
          userId: ownerAId,
          companyId: companyBId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
      ],
    });

    const active = await db.account.create({
      data: {
        companyId: companyAId,
        name: "Arşiv Test Kasa",
        type: "CASH",
        balance: 500,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    activeAccountId = active.id;

    await db.accountTransaction.create({
      data: {
        accountId: activeAccountId,
        type: "INCOME",
        title: "Test hareket",
        amount: 500,
        note: "QA archive history",
      },
    });

    const defaultAccount = await db.account.create({
      data: {
        companyId: companyAId,
        name: "Varsayılan Kasa",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
        isDefault: true,
      },
    });
    defaultAccountId = defaultAccount.id;
  });

  after(async () => {
    const companies = await db.company.findMany({
      where: { name: { startsWith: "TestQA11_Archive" } },
      select: { id: true },
    });
    const companyIds = companies.map((c) => c.id);

    if (companyIds.length > 0) {
      await db.accountTransaction.deleteMany({
        where: { account: { companyId: { in: companyIds } } },
      });
      await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.company.deleteMany({ where: { id: { in: companyIds } } });
    }

    await db.user.deleteMany({
      where: { email: { endsWith: "@qa-faz11.internal" } },
    });
    await db.$disconnect();
  });

  it("current company account archive edilir (PASSIVE)", async () => {
    const { deactivateCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await deactivateCompanyAccount(
      companyAId,
      ownerAId,
      activeAccountId
    );

    assert.equal(result.ok, true);
    const account = await db.account.findUniqueOrThrow({
      where: { id: activeAccountId },
    });
    assert.equal(account.status, "PASSIVE");
    assert.equal(Number(account.balance), 500);
  });

  it("arşivli hesap seçim listesinde görünmez", async () => {
    const { getActiveAccountOptions } = await import("@/lib/account-read-service");
    const options = await getActiveAccountOptions(companyAId);
    assert.equal(
      options.some((account) => account.id === activeAccountId),
      false
    );
  });

  it("geçmiş hareketler korunur", async () => {
    const txCount = await db.accountTransaction.count({
      where: { accountId: activeAccountId },
    });
    assert.equal(txCount, 1);
  });

  it("bakiyesi olan hesap arşivlemede uyarı mesajı döner", async () => {
    const { deactivateCompanyAccount } = await import("@/lib/account-admin-service");
    const fresh = await db.account.create({
      data: {
        companyId: companyAId,
        name: `Bakiyeli ${Date.now()}`,
        type: "CASH",
        balance: 75,
        currency: "TRY",
        status: "ACTIVE",
      },
    });

    const result = await deactivateCompanyAccount(companyAId, ownerAId, fresh.id);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.message ?? "", /Bakiye|arşivlendi/i);
      assert.equal(
        (result.data as { balanceWarning?: boolean }).balanceWarning,
        true
      );
    }
  });

  it("varsayılan hesap arşivlenemez", async () => {
    const { deactivateCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await deactivateCompanyAccount(
      companyAId,
      ownerAId,
      defaultAccountId
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  it("foreign company archive reddedilir (404)", async () => {
    const { deactivateCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await deactivateCompanyAccount(
      companyBId,
      ownerAId,
      activeAccountId
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  it("yeniden aktifleştirme çalışır", async () => {
    const { updateCompanyAccount } = await import("@/lib/account-admin-service");
    const result = await updateCompanyAccount(companyAId, ownerAId, activeAccountId, {
      status: "ACTIVE",
    });
    assert.equal(result.ok, true);

    const { getActiveAccountOptions } = await import("@/lib/account-read-service");
    const options = await getActiveAccountOptions(companyAId);
    assert.equal(
      options.some((account) => account.id === activeAccountId),
      true
    );
  });

  it("fiziksel delete API yok — kayıt DB'de kalır", async () => {
    const service = await import("@/lib/account-admin-service");
    assert.equal(
      typeof (service as { deleteCompanyAccount?: unknown }).deleteCompanyAccount,
      "undefined"
    );

    const count = await db.account.count({ where: { id: activeAccountId } });
    assert.equal(count, 1);
  });
});
