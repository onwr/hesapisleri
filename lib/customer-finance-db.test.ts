/**
 * Customer finance DB integration tests
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  createCustomerCollection,
  createCustomerPayment,
} from "@/lib/customer-finance-service";
import { CustomerFinanceError } from "@/lib/customer-finance-service";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("Customer finance DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerId: string;
  let customerId: string;
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
        email: `qa-customer-finance-${Date.now()}@qa.internal`,
        password: hash,
        name: "QA Customer Finance",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerId = owner.id;

    const companyA = await db.company.create({
      data: { name: `QA_CF_A_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `QA_CF_B_${Date.now()}`, status: "ACTIVE" },
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
        name: `QA Kasa CF ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 1000,
        isDefault: true,
      },
    });
    accountAId = accountA.id;

    const accountB = await db.account.create({
      data: {
        companyId: companyBId,
        name: `QA Kasa CF B ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 500,
        isDefault: true,
      },
    });
    accountBId = accountB.id;

    const customer = await db.customer.create({
      data: {
        companyId: companyAId,
        name: "QA Müşteri CF",
        status: "ACTIVE",
        balance: 500,
      },
    });
    customerId = customer.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  it("customer collection reduces balance and creates account transaction", async () => {
    const beforeCustomer = Number(
      (await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance
    );
    const beforeAccount = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );

    const result = await createCustomerCollection({
      companyId: companyAId,
      customerId,
      userId: ownerId,
      accountId: accountAId,
      amount: 100,
      idempotencyKey: crypto.randomUUID(),
    });

    assert.equal(result.replay, false);
    assert.ok(result.transaction.id);

    const afterCustomer = Number(
      (await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance
    );
    const afterAccount = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );

    assert.equal(afterCustomer, beforeCustomer - 100);
    assert.equal(afterAccount, beforeAccount + 100);
  });

  it("customer payment increases balance and reduces account balance", async () => {
    const beforeCustomer = Number(
      (await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance
    );
    const beforeAccount = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );

    await createCustomerPayment({
      companyId: companyAId,
      customerId,
      userId: ownerId,
      accountId: accountAId,
      amount: 50,
      idempotencyKey: crypto.randomUUID(),
    });

    const afterCustomer = Number(
      (await db.customer.findUniqueOrThrow({ where: { id: customerId } })).balance
    );
    const afterAccount = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );

    assert.equal(afterCustomer, beforeCustomer + 50);
    assert.equal(afterAccount, beforeAccount - 50);
  });

  it("foreign account rejected", async () => {
    await assert.rejects(
      () =>
        createCustomerPayment({
          companyId: companyAId,
          customerId,
          userId: ownerId,
          accountId: accountBId,
          amount: 10,
        }),
      (error: unknown) =>
        error instanceof CustomerFinanceError &&
        /şirkete ait değil/.test(error.message)
    );
  });

  it("insufficient balance rejected without partial records", async () => {
    const txCountBefore = await db.accountTransaction.count({
      where: { accountId: accountAId },
    });

    await assert.rejects(
      () =>
        createCustomerPayment({
          companyId: companyAId,
          customerId,
          userId: ownerId,
          accountId: accountAId,
          amount: 999999,
        }),
      (error: unknown) =>
        error instanceof CustomerFinanceError &&
        /yetersiz/.test(error.message)
    );

    const txCountAfter = await db.accountTransaction.count({
      where: { accountId: accountAId },
    });
    assert.equal(txCountAfter, txCountBefore);
  });

  it("idempotency replay creates single financial effect", async () => {
    const key = crypto.randomUUID();
    const first = await createCustomerCollection({
      companyId: companyAId,
      customerId,
      userId: ownerId,
      accountId: accountAId,
      amount: 25,
      idempotencyKey: key,
    });
    const second = await createCustomerCollection({
      companyId: companyAId,
      customerId,
      userId: ownerId,
      accountId: accountAId,
      amount: 25,
      idempotencyKey: key,
    });

    assert.equal(first.replay, false);
    assert.equal(second.replay, true);
    assert.equal(first.transaction.id, second.transaction.id);
  });
});
