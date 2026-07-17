/**
 * Gün sonu kasa kapanışı — gerçek DB integration testleri.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: cash daily closing DB tests require TEST_DATABASE_URL pointing to a _test database";

describe("gün sonu kasa kapanışı — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let otherCompanyId: string;
  let userId: string;
  let cashAccountId: string;
  let cardAccountId: string;
  let customerId: string;
  let productId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `daily-close-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "Daily Close Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    userId = owner.id;
    userIds.push(owner.id);

    const company = await db.company.create({
      data: { name: `Daily Close Co ${stamp}`, status: "ACTIVE" },
    });
    companyId = company.id;
    companyIds.push(company.id);

    const other = await db.company.create({
      data: { name: `Daily Close Other ${stamp}`, status: "ACTIVE" },
    });
    otherCompanyId = other.id;
    companyIds.push(other.id);

    await db.companyUser.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
    });

    const cash = await db.account.create({
      data: {
        companyId,
        name: "Nakit Kasa",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
        isDefault: true,
      },
    });
    cashAccountId = cash.id;

    const card = await db.account.create({
      data: {
        companyId,
        name: "POS Kart",
        type: "BANK",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    cardAccountId = card.id;

    const customer = await db.customer.create({
      data: {
        companyId,
        name: "Kapanış Müşteri",
        status: "ACTIVE",
        balance: 0,
      },
    });
    customerId = customer.id;

    const product = await db.product.create({
      data: {
        companyId,
        name: "Kapanış Ürün",
        sellPrice: 1000,
        buyPrice: 100,
        vatRate: 0,
        stock: 100,
        productType: "STOCK",
        status: "ACTIVE",
      },
    });
    productId = product.id;
  });

  after(async () => {
    await db.cashDailyClosing.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.salePayment.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.saleItem.deleteMany({
      where: { sale: { companyId: { in: companyIds } } },
    });
    await db.accountTransaction.deleteMany({
      where: { account: { companyId: { in: companyIds } } },
    });
    await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.product.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  async function addCashIncome(amount: number, title: string) {
    await db.accountTransaction.create({
      data: {
        accountId: cashAccountId,
        type: "INCOME",
        title,
        amount,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: cashAccountId },
      data: { balance: { increment: amount } },
    });
  }

  it("A: nakit satış beklenen nakde eklenir", async () => {
    const { previewCashDailyClosing } = await import("./cash-daily-closing-service");
    await addCashIncome(1000, "Satış Tahsilatı - POS-TEST");

    const preview = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    assert.equal(preview.expectedCashAmount, 1000);
  });

  it("B: kart satış beklenen nakde eklenmez", async () => {
    const { previewCashDailyClosing } = await import("./cash-daily-closing-service");

    await db.accountTransaction.create({
      data: {
        accountId: cardAccountId,
        type: "INCOME",
        title: "Kart satış",
        amount: 1000,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: cardAccountId },
      data: { balance: { increment: 1000 } },
    });

    const sale = await db.sale.create({
      data: {
        companyId,
        userId,
        saleNo: `S-CARD-${randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        vatTotal: 0,
        discount: 0,
        total: 1000,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: 1000,
        sourceChannel: "POS",
      },
    });
    await db.salePayment.create({
      data: {
        companyId,
        saleId: sale.id,
        accountId: cardAccountId,
        paymentMethod: "CARD",
        amount: 1000,
      },
    });

    const preview = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    assert.equal(preview.totalCardSales, 1000);
    assert.equal(preview.expectedCashAmount, 1000);
  });

  it("C: veresiye satış beklenen nakde eklenmez", async () => {
    const { previewCashDailyClosing } = await import("./cash-daily-closing-service");

    await db.sale.create({
      data: {
        companyId,
        userId,
        customerId,
        saleNo: `S-CREDIT-${randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        vatTotal: 0,
        discount: 0,
        total: 1000,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        sourceChannel: "POS",
      },
    });
    await db.customer.update({
      where: { id: customerId },
      data: { balance: { increment: 1000 } },
    });

    const preview = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    assert.equal(preview.totalCreditSales >= 1000, true);
    assert.equal(preview.expectedCashAmount, 1000);
  });

  it("D-E: nakit tahsilat + gider beklenen nakdi etkiler", async () => {
    const { previewCashDailyClosing } = await import("./cash-daily-closing-service");

    await db.accountTransaction.create({
      data: {
        accountId: cashAccountId,
        type: "COLLECTION",
        title: "Cari tahsilat — Kapanış Müşteri",
        amount: 500,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: cashAccountId },
      data: { balance: { increment: 500 } },
    });

    await db.accountTransaction.create({
      data: {
        accountId: cashAccountId,
        type: "EXPENSE",
        title: "Gider - Temizlik",
        amount: 200,
        date: new Date(),
      },
    });
    await db.account.update({
      where: { id: cashAccountId },
      data: { balance: { decrement: 200 } },
    });

    const preview = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    assert.equal(preview.expectedCashAmount, 1300);
    assert.equal(preview.totalCollections, 500);
    assert.equal(preview.totalExpenses, 200);
  });

  it("H-I: kapanış oluşturur, farkı hesaplar, duplicate reddeder", async () => {
    const {
      createCashDailyClosing,
      CashDailyClosingError,
    } = await import("./cash-daily-closing-service");

    const closing = await createCashDailyClosing({
      companyId,
      userId,
      accountId: cashAccountId,
      closingDate: new Date(),
      countedCashAmount: 1250,
      note: "Akşam sayımı",
    });

    assert.equal(Number(closing.expectedCashAmount), 1300);
    assert.equal(Number(closing.countedCashAmount), 1250);
    assert.equal(Number(closing.differenceAmount), -50);

    await assert.rejects(
      () =>
        createCashDailyClosing({
          companyId,
          userId,
          accountId: cashAccountId,
          closingDate: new Date(),
          countedCashAmount: 1300,
        }),
      (error: unknown) =>
        error instanceof CashDailyClosingError &&
        error.message.includes("zaten yapılmış")
    );
  });

  it("J: başka tenant kasa hesabı reddedilir", async () => {
    const {
      previewCashDailyClosing,
      CashDailyClosingError,
    } = await import("./cash-daily-closing-service");

    const foreignCash = await db.account.create({
      data: {
        companyId: otherCompanyId,
        name: "Yabancı Kasa",
        type: "CASH",
        balance: 10,
        currency: "TRY",
        status: "ACTIVE",
      },
    });

    await assert.rejects(
      () =>
        previewCashDailyClosing({
          companyId,
          accountId: foreignCash.id,
          closingDate: new Date(),
        }),
      (error: unknown) =>
        error instanceof CashDailyClosingError &&
        error.message.includes("Kasa hesabı bulunamadı")
    );
  });
});
