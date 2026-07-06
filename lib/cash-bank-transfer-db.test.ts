/**
 * Kasalar arası transfer — GERÇEK PostgreSQL DB integration testleri.
 * Kaynak tarama DEĞİLDİR — applyAccountTransfer gerçek DB'ye karşı çalıştırılır.
 * TEST_DATABASE_URL yoksa kontrollü skip edilir (bkz. SKIP_REASON).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: cash-bank transfer DB integration tests require TEST_DATABASE_URL pointing to a _test database";

describe("kasa transferi — gerçek DB integration", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;
  let userIds: string[] = [];
  let companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `xfer-db-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "Transfer DB Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    ownerAId = owner.id;
    userIds.push(owner.id);

    const companyA = await db.company.create({
      data: { name: `Transfer DB Co A ${stamp}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;
    companyIds.push(companyA.id);

    const companyB = await db.company.create({
      data: { name: `Transfer DB Co B ${stamp}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;
    companyIds.push(companyB.id);

    await db.companyUser.create({
      data: {
        userId: ownerAId,
        companyId: companyAId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    await db.accountTransaction.deleteMany({ where: { account: { companyId: { in: companyIds } } } });
    await db.accountTransferIdempotency.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  async function createAccount(companyId: string, name: string, balance: number, currency = "TRY") {
    return db.account.create({
      data: { companyId, name, type: "CASH", balance, currency, status: "ACTIVE" },
    });
  }

  it("aynı key + aynı payload → tek transfer, iki AccountTransaction, replay, aynı transferGroupId", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const from = await createAccount(companyAId, "Kasa Xfer From", 1000);
    const to = await createAccount(companyAId, "Kasa Xfer To", 0);
    const key = randomUUID();
    const data = { fromAccountId: from.id, toAccountId: to.id, amount: 100, idempotencyKey: key };

    const first = await applyAccountTransfer({ companyId: companyAId, userId: ownerAId, data });
    assert.equal(first.ok, true);
    assert.equal((first as any).replayed, false);

    const second = await applyAccountTransfer({ companyId: companyAId, userId: ownerAId, data });
    assert.equal(second.ok, true);
    assert.equal((second as any).replayed, true);

    const txCount = await db.accountTransaction.count({
      where: { accountId: { in: [from.id, to.id] } },
    });
    assert.equal(txCount, 2);

    const txs = await db.accountTransaction.findMany({
      where: { accountId: { in: [from.id, to.id] } },
    });
    assert.equal(txs[0]!.transferGroupId, txs[1]!.transferGroupId);
    assert.ok(txs[0]!.transferGroupId);

    const claimCount = await db.accountTransferIdempotency.count({
      where: { companyId: companyAId, idempotencyKey: key },
    });
    assert.equal(claimCount, 1);

    const fromAfter = await db.account.findUnique({ where: { id: from.id } });
    const toAfter = await db.account.findUnique({ where: { id: to.id } });
    assert.equal(Number(fromAfter!.balance), 900);
    assert.equal(Number(toAfter!.balance), 100);
  });

  it("aynı key + farklı payload → 409, ekstra hareket oluşmaz", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const from = await createAccount(companyAId, "Kasa Conflict From", 500);
    const to = await createAccount(companyAId, "Kasa Conflict To", 0);
    const key = randomUUID();

    const first = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: from.id, toAccountId: to.id, amount: 50, idempotencyKey: key },
    });
    assert.equal(first.ok, true);

    const conflicting = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: from.id, toAccountId: to.id, amount: 999, idempotencyKey: key },
    });
    assert.equal(conflicting.ok, false);
    assert.equal((conflicting as any).status, 409);

    const txCount = await db.accountTransaction.count({
      where: { accountId: { in: [from.id, to.id] } },
    });
    assert.equal(txCount, 2, "sadece ilk transferin iki hareketi olmalı");
  });

  it("gerçek concurrency — Promise.all eşzamanlı aynı key, unique constraint yarışı güvenli, bakiye tek kez değişir", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const from = await createAccount(companyAId, "Kasa Concurrent From", 300);
    const to = await createAccount(companyAId, "Kasa Concurrent To", 0);
    const key = randomUUID();
    const data = { fromAccountId: from.id, toAccountId: to.id, amount: 100, idempotencyKey: key };

    const results = await Promise.all([
      applyAccountTransfer({ companyId: companyAId, userId: ownerAId, data }),
      applyAccountTransfer({ companyId: companyAId, userId: ownerAId, data }),
      applyAccountTransfer({ companyId: companyAId, userId: ownerAId, data }),
    ]);

    assert.ok(results.every((r) => r.ok), "hepsi başarılı dönmeli (biri gerçek, diğerleri replay)");
    const replayedCount = results.filter((r) => (r as any).replayed === true).length;
    assert.equal(replayedCount, 2);

    const fromAfter = await db.account.findUnique({ where: { id: from.id } });
    const toAfter = await db.account.findUnique({ where: { id: to.id } });
    assert.equal(Number(fromAfter!.balance), 200, "kaynak bakiye yalnız bir kez azalmalı");
    assert.equal(Number(toAfter!.balance), 100, "hedef bakiye yalnız bir kez artmalı");

    const txCount = await db.accountTransaction.count({
      where: { accountId: { in: [from.id, to.id] } },
    });
    assert.equal(txCount, 2, "yalnız tek transferin iki hareketi oluşmalı");
  });

  it("PROCESSING kaydı — sonsuz bekleme/duplicate transfer oluşturmadan güvenli 409 döner", async () => {
    const key = randomUUID();
    const from = await createAccount(companyAId, "Kasa Processing From", 400);
    const to = await createAccount(companyAId, "Kasa Processing To", 0);

    // PROCESSING durumunu manuel simüle et (yarış anında kalmış hayali kayıt).
    const { createHash } = await import("node:crypto");
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ fromAccountId: from.id, toAccountId: to.id, amount: 100, note: null }))
      .digest("hex");

    await db.accountTransferIdempotency.create({
      data: {
        companyId: companyAId,
        idempotencyKey: key,
        payloadHash,
        status: "PROCESSING",
      },
    });

    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const result = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: from.id, toAccountId: to.id, amount: 100, idempotencyKey: key },
    });

    assert.equal(result.ok, false);
    assert.equal((result as any).status, 409);

    const txCount = await db.accountTransaction.count({
      where: { accountId: { in: [from.id, to.id] } },
    });
    assert.equal(txCount, 0, "PROCESSING durumunda hiçbir hareket oluşmamalı");

    const fromAfter = await db.account.findUnique({ where: { id: from.id } });
    assert.equal(Number(fromAfter!.balance), 400, "bakiye değişmemeli");
  });

  it("başka company aynı idempotencyKey'i kullanabilir (companyId+key birleşik unique)", async () => {
    await db.companyUser.create({
      data: { userId: ownerAId, companyId: companyBId, role: "OWNER", isOwner: true, status: "ACTIVE" },
    });
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const key = randomUUID();

    const fromA = await createAccount(companyAId, "Kasa Shared Key A From", 200);
    const toA = await createAccount(companyAId, "Kasa Shared Key A To", 0);
    const fromB = await createAccount(companyBId, "Kasa Shared Key B From", 200);
    const toB = await createAccount(companyBId, "Kasa Shared Key B To", 0);

    const resultA = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: fromA.id, toAccountId: toA.id, amount: 50, idempotencyKey: key },
    });
    const resultB = await applyAccountTransfer({
      companyId: companyBId,
      userId: ownerAId,
      data: { fromAccountId: fromB.id, toAccountId: toB.id, amount: 75, idempotencyKey: key },
    });

    assert.equal(resultA.ok, true);
    assert.equal(resultB.ok, true);
    assert.equal((resultA as any).replayed, false);
    assert.equal((resultB as any).replayed, false);
  });

  it("başka company hesabına transfer reddedilir (tenant isolation)", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const fromA = await createAccount(companyAId, "Kasa Cross From", 500);
    const toB = await createAccount(companyBId, "Kasa Cross To", 0);

    const result = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: fromA.id, toAccountId: toB.id, amount: 50, idempotencyKey: randomUUID() },
    });

    assert.equal(result.ok, false);
    assert.equal((result as any).status, 404);

    const txCount = await db.accountTransaction.count({ where: { accountId: { in: [fromA.id, toB.id] } } });
    assert.equal(txCount, 0);
  });

  it("para birimi uyuşmazlığı reddedilir", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const fromTry = await createAccount(companyAId, "Kasa TRY", 500, "TRY");
    const toUsd = await createAccount(companyAId, "Kasa USD", 0, "USD");

    const result = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: fromTry.id, toAccountId: toUsd.id, amount: 50, idempotencyKey: randomUUID() },
    });

    assert.equal(result.ok, false);
    assert.equal((result as any).status, 400);
  });

  it("aynı kaynak/hedef hesap reddedilir", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const acc = await createAccount(companyAId, "Kasa Same Account", 500);

    const result = await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: acc.id, toAccountId: acc.id, amount: 50, idempotencyKey: randomUUID() },
    });

    assert.equal(result.ok, false);
    assert.equal((result as any).status, 400);
  });

  it("transfer gelir/gider raporuna girmez (type=TRANSFER, INCOME/EXPENSE raporlarından hariç)", async () => {
    const { applyAccountTransfer } = await import("./cash-bank-account-service");
    const from = await createAccount(companyAId, "Kasa Report From", 500);
    const to = await createAccount(companyAId, "Kasa Report To", 0);

    await applyAccountTransfer({
      companyId: companyAId,
      userId: ownerAId,
      data: { fromAccountId: from.id, toAccountId: to.id, amount: 100, idempotencyKey: randomUUID() },
    });

    const incomeExpenseCount = await db.accountTransaction.count({
      where: {
        accountId: { in: [from.id, to.id] },
        type: { in: ["INCOME", "EXPENSE"] },
      },
    });
    assert.equal(incomeExpenseCount, 0, "transfer hareketleri INCOME/EXPENSE olarak sınıflanmamalı");

    const transferCount = await db.accountTransaction.count({
      where: { accountId: { in: [from.id, to.id] }, type: "TRANSFER" },
    });
    assert.equal(transferCount, 2);
  });
});
