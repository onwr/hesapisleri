/**
 * QA Faz 3B — tedarikçi cari DB integration testleri
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { calculateSupplierBalance } from "@/lib/supplier-balance-service";
import { createSupplierPayment, createSupplierCollection } from "@/lib/supplier-finance-service";
import { resolveSupplierBalanceView } from "@/lib/supplier-balance-utils";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 3B — supplier ledger DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerId: string;
  let supplierAId: string;
  let accountAId: string;
  let accountBId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const owner = await db.user.create({
      data: {
        email: `qa-faz3b-${Date.now()}@qa.internal`,
        password: hash,
        name: "QA Faz3B",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerId = owner.id;

    const companyA = await db.company.create({
      data: { name: `QA3B_A_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `QA3B_B_${Date.now()}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;

    await db.companyUser.createMany({
      data: [
        {
          userId: ownerId,
          companyId: companyAId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
        {
          userId: ownerId,
          companyId: companyBId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
      ],
    });

    const accountA = await db.account.create({
      data: {
        companyId: companyAId,
        name: `QA Kasa 3B ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 10000,
        isDefault: true,
      },
    });
    accountAId = accountA.id;

    const accountB = await db.account.create({
      data: {
        companyId: companyBId,
        name: `QA Kasa B 3B ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 5000,
        isDefault: true,
      },
    });
    accountBId = accountB.id;

    const supplierA = await db.supplier.create({
      data: {
        companyId: companyAId,
        name: "QA Tedarikçi 3B",
        openingBalance: 1000,
        currentBalance: 1000,
        currency: "TRY",
      },
    });
    supplierAId = supplierA.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("unpaid expense increases payable", async () => {
    await db.expense.create({
      data: {
        companyId: companyAId,
        supplierId: supplierAId,
        title: "QA Gider 3B",
        amount: 500,
        paymentStatus: "UNPAID",
        status: "APPROVED",
      },
    });

    const balance = await calculateSupplierBalance(companyAId, supplierAId);
    assert.equal(balance, 1500);
  });

  it("supplier payment atomic and reduces payable", async () => {
    await createSupplierPayment({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 400,
      idempotencyKey: crypto.randomUUID(),
    });

    const balance = await calculateSupplierBalance(companyAId, supplierAId);
    assert.equal(balance, 1100);

    const account = await db.account.findUniqueOrThrow({ where: { id: accountAId } });
    assert.equal(Number(account.balance), 9600);
  });

  it("overpayment creates receivable", async () => {
    await createSupplierPayment({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 1500,
      idempotencyKey: crypto.randomUUID(),
    });

    const balance = await calculateSupplierBalance(companyAId, supplierAId);
    assert.equal(balance, -400);
    const view = resolveSupplierBalanceView(balance!);
    assert.equal(view.receivableAmount, 400);
  });

  it("collection reduces receivable", async () => {
    await createSupplierCollection({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 200,
      idempotencyKey: crypto.randomUUID(),
    });

    const balance = await calculateSupplierBalance(companyAId, supplierAId);
    assert.equal(balance, -200);
  });

  it("foreign account rejected", async () => {
    await assert.rejects(
      () =>
        createSupplierPayment({
          companyId: companyAId,
          supplierId: supplierAId,
          userId: ownerId,
          accountId: accountBId,
          amount: 10,
        }),
      /firmaya ait değil/
    );
  });

  it("idempotency replay single financial effect", async () => {
    const key = crypto.randomUUID();
    const first = await createSupplierPayment({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 50,
      idempotencyKey: key,
    });
    const second = await createSupplierPayment({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 50,
      idempotencyKey: key,
    });

    assert.equal(first.replay, false);
    assert.equal(second.replay, true);

    const count = await db.supplierLedgerEntry.count({
      where: { companyId: companyAId, idempotencyKey: key },
    });
    assert.equal(count, 1);
  });

  it("idempotency conflict on different payload", async () => {
    const key = crypto.randomUUID();
    await createSupplierPayment({
      companyId: companyAId,
      supplierId: supplierAId,
      userId: ownerId,
      accountId: accountAId,
      amount: 25,
      idempotencyKey: key,
    });

    await assert.rejects(
      () =>
        createSupplierPayment({
          companyId: companyAId,
          supplierId: supplierAId,
          userId: ownerId,
          accountId: accountAId,
          amount: 30,
          idempotencyKey: key,
        }),
      /farklı ödeme verisiyle/
    );
  });

  it("reconciliation expected equals current", async () => {
    const { reconcileSupplierBalanceRow } = await import(
      "@/lib/supplier-reconciliation-service"
    );
    await syncSupplierBalanceFromService(companyAId, supplierAId);
    const row = await reconcileSupplierBalanceRow(companyAId, supplierAId);
    assert.ok(row);
    assert.equal(row!.delta, 0);
    assert.equal(row!.expectedBalance, row!.currentBalance);
  });
});

async function syncSupplierBalanceFromService(companyId: string, supplierId: string) {
  const { syncSupplierBalance } = await import("@/lib/supplier-balance-service");
  await syncSupplierBalance(companyId, supplierId);
}

describe("QA Faz 3B — opening balance create", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let userId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const owner = await db.user.create({
      data: {
        email: `qa-faz3b-open-${Date.now()}@qa.internal`,
        password: await hashPassword("TestPass123!"),
        name: "QA Open",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    userId = owner.id;

    const company = await db.company.create({
      data: { name: `QA3B_OPEN_${Date.now()}`, status: "ACTIVE" },
    });
    companyId = company.id;

    await db.companyUser.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
        status: "ACTIVE",
        isOwner: true,
      },
    });
  });

  after(async () => {
    await db.$disconnect();
  });

  it("opening PAYABLE creates single ledger entry", async () => {
    const { createSupplier } = await import("@/lib/supplier-service");
    const requestId = crypto.randomUUID();
    const result = await createSupplier({
      companyId,
      userId,
      data: {
        name: "Açılış Borçlu",
        openingBalanceAmount: 250,
        openingBalanceDirection: "PAYABLE",
        clientRequestId: requestId,
      },
    });

    assert.equal(Number(result.supplier.openingBalance), 250);
    const ledgerCount = await db.supplierLedgerEntry.count({
      where: {
        companyId,
        supplierId: result.supplier.id,
        type: "OPENING_BALANCE",
      },
    });
    assert.equal(ledgerCount, 1);

    const replay = await createSupplier({
      companyId,
      userId,
      data: {
        name: "Başka Tedarikçi",
        openingBalanceAmount: 100,
        openingBalanceDirection: "PAYABLE",
        clientRequestId: requestId,
      },
    });
    assert.equal(replay.replay, true);
    assert.equal(replay.supplier.id, result.supplier.id);
  });

  it("opening RECEIVABLE is signed negative", async () => {
    const { createSupplier } = await import("@/lib/supplier-service");
    const result = await createSupplier({
      companyId,
      userId,
      data: {
        name: "Açılış Alacaklı",
        openingBalanceAmount: 180,
        openingBalanceDirection: "RECEIVABLE",
        clientRequestId: crypto.randomUUID(),
      },
    });
    assert.equal(Number(result.supplier.openingBalance), -180);
  });

  it("opening SETTLED has no ledger entry", async () => {
    const { createSupplier } = await import("@/lib/supplier-service");
    const result = await createSupplier({
      companyId,
      userId,
      data: {
        name: "Açılış Kapalı",
        openingBalanceAmount: 0,
        openingBalanceDirection: "SETTLED",
        clientRequestId: crypto.randomUUID(),
      },
    });
    assert.equal(Number(result.supplier.openingBalance), 0);
    const ledgerCount = await db.supplierLedgerEntry.count({
      where: { companyId, supplierId: result.supplier.id, type: "OPENING_BALANCE" },
    });
    assert.equal(ledgerCount, 0);
  });
});
