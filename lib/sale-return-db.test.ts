/**
 * Satış iadesi — gerçek DB integration testleri.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: sale return DB tests require TEST_DATABASE_URL pointing to a _test database";

describe("satış iadesi — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let otherCompanyId: string;
  let userId: string;
  let customerId: string;
  let cashAccountId: string;
  let cardAccountId: string;
  let warehouseId: string;
  let stockProductId: string;
  let serviceProductId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `sale-return-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "Return Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    userId = owner.id;
    userIds.push(owner.id);

    const company = await db.company.create({
      data: { name: `Return Co ${stamp}`, status: "ACTIVE" },
    });
    companyId = company.id;
    companyIds.push(company.id);

    const otherCompany = await db.company.create({
      data: { name: `Return Other ${stamp}`, status: "ACTIVE" },
    });
    otherCompanyId = otherCompany.id;
    companyIds.push(otherCompany.id);

    await db.companyUser.create({
      data: {
        userId,
        companyId,
        role: "OWNER",
        isOwner: true,
        status: "ACTIVE",
      },
    });

    const customer = await db.customer.create({
      data: {
        companyId,
        name: "İade Müşteri",
        status: "ACTIVE",
        balance: 0,
      },
    });
    customerId = customer.id;

    const warehouse = await db.warehouse.create({
      data: {
        companyId,
        name: "Ana Depo",
        code: `RW-${stamp.slice(-6)}`,
        status: "ACTIVE",
        isDefault: true,
      },
    });
    warehouseId = warehouse.id;

    const stockProduct = await db.product.create({
      data: {
        companyId,
        name: "İade Ürün",
        sellPrice: 100,
        buyPrice: 40,
        vatRate: 20,
        stock: 20,
        productType: "STOCK",
        status: "ACTIVE",
      },
    });
    stockProductId = stockProduct.id;

    await db.warehouseStock.create({
      data: {
        companyId,
        warehouseId,
        productId: stockProductId,
        quantity: 20,
      },
    });

    const serviceProduct = await db.product.create({
      data: {
        companyId,
        name: "Montaj Hizmeti",
        sellPrice: 150,
        buyPrice: 0,
        vatRate: 20,
        stock: 0,
        productType: "SERVICE",
        status: "ACTIVE",
      },
    });
    serviceProductId = serviceProduct.id;

    const cash = await db.account.create({
      data: {
        companyId,
        name: "Nakit Kasa",
        type: "CASH",
        balance: 5000,
        status: "ACTIVE",
        isDefault: true,
      },
    });
    cashAccountId = cash.id;

    const card = await db.account.create({
      data: {
        companyId,
        name: "POS Kart",
        type: "POS",
        balance: 2000,
        status: "ACTIVE",
      },
    });
    cardAccountId = card.id;
  });

  after(async () => {
    if (!db) return;
    for (const id of companyIds) {
      await db.saleReturnItem.deleteMany({ where: { companyId: id } });
      await db.saleReturn.deleteMany({ where: { companyId: id } });
      await db.salePayment.deleteMany({ where: { companyId: id } });
      await db.saleItem.deleteMany({
        where: { sale: { companyId: id } },
      });
      await db.sale.deleteMany({ where: { companyId: id } });
      await db.stockMovement.deleteMany({ where: { companyId: id } });
      await db.warehouseStock.deleteMany({ where: { companyId: id } });
      await db.product.deleteMany({ where: { companyId: id } });
      await db.warehouse.deleteMany({ where: { companyId: id } });
      await db.accountTransaction.deleteMany({
        where: { account: { companyId: id } },
      });
      await db.account.deleteMany({ where: { companyId: id } });
      await db.customer.deleteMany({ where: { companyId: id } });
      await db.activityLog.deleteMany({ where: { companyId: id } });
      await db.notification.deleteMany({ where: { companyId: id } });
      await db.companyUser.deleteMany({ where: { companyId: id } });
      await db.company.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of userIds) {
      await db.user.delete({ where: { id } }).catch(() => undefined);
    }
    await db.$disconnect();
  });

  async function createPaidCashSale(input?: {
    quantity?: number;
    unitPrice?: number;
    deductStock?: boolean;
  }) {
    const qty = input?.quantity ?? 2;
    const unitPrice = input?.unitPrice ?? 100;
    const total = qty * unitPrice;
    const sale = await db.sale.create({
      data: {
        companyId,
        customerId,
        userId,
        saleNo: `SR-${randomUUID().slice(0, 8)}`,
        status: "COMPLETED",
        paymentStatus: "PAID",
        subtotal: total,
        vatTotal: 0,
        discount: 0,
        total,
        paidAmount: total,
        warehouseId,
        items: {
          create: [
            {
              productId: stockProductId,
              warehouseId,
              name: "İade Ürün",
              quantity: qty,
              unitPrice,
              vatRate: 20,
              total,
            },
          ],
        },
        payments: {
          create: [
            {
              companyId,
              accountId: cashAccountId,
              paymentMethod: "CASH",
              amount: total,
            },
          ],
        },
      },
      include: { items: true },
    });

    await db.accountTransaction.create({
      data: {
        accountId: cashAccountId,
        type: "INCOME",
        title: `Satış Tahsilatı - ${sale.saleNo}`,
        amount: total,
        note: sale.saleNo,
      },
    });
    await db.account.update({
      where: { id: cashAccountId },
      data: { balance: { increment: total } },
    });

    if (input?.deductStock !== false) {
      await db.warehouseStock.updateMany({
        where: { companyId, productId: stockProductId, warehouseId },
        data: { quantity: { decrement: qty } },
      });
      await db.stockMovement.create({
        data: {
          companyId,
          productId: stockProductId,
          warehouseId,
          type: "SALE",
          quantity: qty,
          note: `${sale.saleNo} satış`,
        },
      });
      await db.product.update({
        where: { id: stockProductId },
        data: { stock: { decrement: qty } },
      });
    }

    return sale;
  }

  it("A: tam nakit iade — stok + kasa + REFUNDED", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const sale = await createPaidCashSale({ quantity: 2, unitPrice: 100 });
    const stockBefore = await db.warehouseStock.findFirst({
      where: { companyId, productId: stockProductId, warehouseId },
    });
    const cashBefore = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });

    const result = await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CASH",
      accountId: cashAccountId,
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 2 }],
    });

    const updatedSale = await db.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    const stockAfter = await db.warehouseStock.findFirst({
      where: { companyId, productId: stockProductId, warehouseId },
    });
    const cashAfter = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });
    const expense = await db.accountTransaction.findFirst({
      where: {
        accountId: cashAccountId,
        type: "EXPENSE",
        title: { contains: sale.saleNo },
      },
    });

    assert.equal(updatedSale.status, "REFUNDED");
    assert.equal(Number(result.saleReturn.totalCashRefund), 200);
    assert.equal(stockAfter!.quantity, stockBefore!.quantity + 2);
    assert.equal(Number(cashAfter.balance), Number(cashBefore.balance) - 200);
    assert.ok(expense);
    assert.match(expense!.title, /Satış iadesi/);
  });

  it("B: kısmi nakit iade — PARTIALLY_REFUNDED", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const sale = await createPaidCashSale({ quantity: 3, unitPrice: 50 });

    await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CASH",
      accountId: cashAccountId,
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 1 }],
    });

    const updatedSale = await db.sale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    assert.equal(updatedSale.status, "PARTIALLY_REFUNDED");

    await assert.rejects(
      () =>
        createSaleReturn({
          companyId,
          userId,
          saleId: sale.id,
          reason: "İade",
          refundMethod: "CASH",
          accountId: cashAccountId,
          lines: [{ saleItemId: sale.items[0]!.id, quantity: 3 }],
        }),
      /iade edilebilir adet/i
    );
  });

  it("C: kart iade nakit kasayı etkilemez", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const total = 120;
    const sale = await db.sale.create({
      data: {
        companyId,
        customerId,
        userId,
        saleNo: `SR-CARD-${randomUUID().slice(0, 8)}`,
        status: "COMPLETED",
        paymentStatus: "PAID",
        subtotal: total,
        vatTotal: 0,
        discount: 0,
        total,
        paidAmount: total,
        warehouseId,
        items: {
          create: [
            {
              productId: stockProductId,
              warehouseId,
              name: "İade Ürün",
              quantity: 1,
              unitPrice: total,
              vatRate: 20,
              total,
            },
          ],
        },
        payments: {
          create: [
            {
              companyId,
              accountId: cardAccountId,
              paymentMethod: "CARD",
              amount: total,
            },
          ],
        },
      },
      include: { items: true },
    });

    const cashBefore = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });
    const cardBefore = await db.account.findUniqueOrThrow({
      where: { id: cardAccountId },
    });

    await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CARD",
      accountId: cardAccountId,
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 1 }],
    });

    const cashAfter = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });
    const cardAfter = await db.account.findUniqueOrThrow({
      where: { id: cardAccountId },
    });

    assert.equal(Number(cashAfter.balance), Number(cashBefore.balance));
    assert.equal(Number(cardAfter.balance), Number(cardBefore.balance) - total);
  });

  it("D: veresiye iade müşteri borcunu azaltır, kasa yok", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const total = 300;
    await db.customer.update({
      where: { id: customerId },
      data: { balance: total },
    });
    const sale = await db.sale.create({
      data: {
        companyId,
        customerId,
        userId,
        saleNo: `SR-CREDIT-${randomUUID().slice(0, 8)}`,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        subtotal: total,
        vatTotal: 0,
        discount: 0,
        total,
        paidAmount: 0,
        warehouseId,
        items: {
          create: [
            {
              productId: stockProductId,
              warehouseId,
              name: "İade Ürün",
              quantity: 3,
              unitPrice: 100,
              vatRate: 20,
              total,
            },
          ],
        },
      },
      include: { items: true },
    });

    const cashBefore = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });

    await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CREDIT",
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 1 }],
    });

    const customer = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
    });
    const cashAfter = await db.account.findUniqueOrThrow({
      where: { id: cashAccountId },
    });
    const expenseCount = await db.accountTransaction.count({
      where: {
        accountId: cashAccountId,
        type: "EXPENSE",
        title: { contains: sale.saleNo },
      },
    });

    assert.equal(Number(customer.balance), total - 100);
    assert.equal(Number(cashAfter.balance), Number(cashBefore.balance));
    assert.equal(expenseCount, 0);
  });

  it("F: SERVICE ürün stok hareketi oluşturmaz", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const total = 150;
    const sale = await db.sale.create({
      data: {
        companyId,
        customerId,
        userId,
        saleNo: `SR-SVC-${randomUUID().slice(0, 8)}`,
        status: "COMPLETED",
        paymentStatus: "PAID",
        subtotal: total,
        vatTotal: 0,
        discount: 0,
        total,
        paidAmount: total,
        items: {
          create: [
            {
              productId: serviceProductId,
              name: "Montaj Hizmeti",
              quantity: 1,
              unitPrice: total,
              vatRate: 20,
              total,
            },
          ],
        },
        payments: {
          create: [
            {
              companyId,
              accountId: cashAccountId,
              paymentMethod: "CASH",
              amount: total,
            },
          ],
        },
      },
      include: { items: true },
    });

    await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CASH",
      accountId: cashAccountId,
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 1, restock: true }],
    });

    const movements = await db.stockMovement.count({
      where: {
        companyId,
        productId: serviceProductId,
        type: "RETURN",
        note: { contains: sale.saleNo },
      },
    });
    assert.equal(movements, 0);
  });

  it("I/J: iptal satış ve başka tenant reddedilir", async () => {
    const { createSaleReturn, SaleReturnError } = await import(
      "./sale-return-service"
    );
    const sale = await createPaidCashSale({ quantity: 1 });
    await db.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
    });

    await assert.rejects(
      () =>
        createSaleReturn({
          companyId,
          userId,
          saleId: sale.id,
          reason: "İade",
          refundMethod: "CASH",
          accountId: cashAccountId,
          lines: [{ saleItemId: sale.items[0]!.id, quantity: 1 }],
        }),
      (error: unknown) =>
        error instanceof SaleReturnError &&
        error.message.includes("iade yapılamaz")
    );

    const otherSale = await db.sale.create({
      data: {
        companyId: otherCompanyId,
        saleNo: `SR-OTHER-${randomUUID().slice(0, 8)}`,
        status: "COMPLETED",
        paymentStatus: "PAID",
        total: 50,
        paidAmount: 50,
        items: {
          create: [
            {
              name: "Yabancı",
              quantity: 1,
              unitPrice: 50,
              vatRate: 0,
              total: 50,
            },
          ],
        },
      },
      include: { items: true },
    });

    await assert.rejects(
      () =>
        createSaleReturn({
          companyId,
          userId,
          saleId: otherSale.id,
          reason: "İade",
          refundMethod: "CASH",
          accountId: cashAccountId,
          lines: [{ saleItemId: otherSale.items[0]!.id, quantity: 1 }],
        }),
      (error: unknown) =>
        error instanceof SaleReturnError && error.status === 404
    );
  });

  it("M: nakit iade gün sonu beklenen kasadan düşer", async () => {
    const { createSaleReturn } = await import("./sale-return-service");
    const { previewCashDailyClosing } = await import(
      "./cash-daily-closing-service"
    );

    const sale = await createPaidCashSale({ quantity: 1, unitPrice: 80 });
    const before = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    await createSaleReturn({
      companyId,
      userId,
      saleId: sale.id,
      reason: "İade",
      refundMethod: "CASH",
      accountId: cashAccountId,
      lines: [{ saleItemId: sale.items[0]!.id, quantity: 1 }],
    });

    const after = await previewCashDailyClosing({
      companyId,
      accountId: cashAccountId,
      closingDate: new Date(),
    });

    assert.equal(after.expectedCashAmount, before.expectedCashAmount - 80);
    assert.ok(after.totalRefunds >= before.totalRefunds);
  });
});
