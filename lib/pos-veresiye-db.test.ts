/**
 * POS Cari/Veresiye satış DB integration testleri.
 * TEST_DATABASE_URL gerekir (hesapisleri_test).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: POS veresiye DB tests require TEST_DATABASE_URL pointing to a _test database";

describe("POS cari/veresiye — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let otherCompanyId: string;
  let userId: string;
  let customerId: string;
  let stockProductId: string;
  let serviceProductId: string;
  let accountId: string;
  let warehouseId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `pos-veresiye-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "POS Veresiye Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    userId = owner.id;
    userIds.push(owner.id);

    const company = await db.company.create({
      data: { name: `POS Veresiye Co ${stamp}`, status: "ACTIVE" },
    });
    companyId = company.id;
    companyIds.push(company.id);

    const otherCompany = await db.company.create({
      data: { name: `POS Veresiye Other ${stamp}`, status: "ACTIVE" },
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
        name: "Veresiye Müşteri",
        status: "ACTIVE",
        balance: 0,
      },
    });
    customerId = customer.id;

    const warehouse = await db.warehouse.create({
      data: {
        companyId,
        name: "Ana Depo",
        code: `W-${stamp.slice(-6)}`,
        status: "ACTIVE",
        isDefault: true,
      },
    });
    warehouseId = warehouse.id;

    const stockProduct = await db.product.create({
      data: {
        companyId,
        name: "Stoklu Ürün",
        sellPrice: 100,
        buyPrice: 50,
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
        name: "Hizmet Ürün",
        sellPrice: 200,
        buyPrice: 0,
        vatRate: 20,
        stock: 0,
        productType: "SERVICE",
        status: "ACTIVE",
      },
    });
    serviceProductId = serviceProduct.id;

    const account = await db.account.create({
      data: {
        companyId,
        name: "Nakit Kasa",
        type: "CASH",
        balance: 1000,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    accountId = account.id;
  });

  after(async () => {
    await db.stockMovement.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.warehouseStock.deleteMany({
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
    await db.notification.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.product.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.warehouse.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("A: tam veresiye satış stok düşer, kasa yok, cari borç artar, UNPAID", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const beforeStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });
    const beforeBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    const beforeAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });

    const result = await executePosCheckout({
      companyId,
      userId,
      data: {
        idempotencyKey: randomUUID(),
        customerId,
        paymentStatus: "UNPAID",
        discount: 0,
        warehouseId,
        items: [
          {
            productId: stockProductId,
            name: "Stoklu Ürün",
            quantity: 2,
            unitPrice: 100,
            vatRate: 20,
          },
        ],
        payments: [],
      },
    });

    assert.equal(result.sale.paymentStatus, "UNPAID");
    assert.equal(Number(result.sale.paidAmount), 0);
    assert.equal(Number(result.sale.total), 240);

    const afterStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });
    assert.equal(Number(afterStock.stock), Number(beforeStock.stock) - 2);

    const afterBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    assert.equal(Number(afterBalance.balance), Number(beforeBalance.balance) + 240);

    const afterAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    assert.equal(Number(afterAccount.balance), Number(beforeAccount.balance));

    const txCount = await db.accountTransaction.count({
      where: { accountId, title: { contains: result.sale.saleNo } },
    });
    assert.equal(txCount, 0);
  });

  it("B: SERVICE veresiye stok hareketi üretmez, cari artar", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const movementsBefore = await db.stockMovement.count({
      where: { companyId, productId: serviceProductId },
    });
    const beforeBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });

    const result = await executePosCheckout({
      companyId,
      userId,
      data: {
        idempotencyKey: randomUUID(),
        customerId,
        paymentStatus: "UNPAID",
        discount: 0,
        items: [
          {
            productId: serviceProductId,
            name: "Hizmet Ürün",
            quantity: 1,
            unitPrice: 200,
            vatRate: 20,
          },
        ],
        payments: [],
      },
    });

    assert.equal(result.sale.paymentStatus, "UNPAID");
    const movementsAfter = await db.stockMovement.count({
      where: { companyId, productId: serviceProductId },
    });
    assert.equal(movementsAfter, movementsBefore);

    const afterBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    assert.equal(Number(afterBalance.balance), Number(beforeBalance.balance) + 240);
  });

  it("C: müşterisiz veresiye reddedilir", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const beforeStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });

    await assert.rejects(
      () =>
        executePosCheckout({
          companyId,
          userId,
          data: {
            idempotencyKey: randomUUID(),
            paymentStatus: "UNPAID",
            discount: 0,
            items: [
              {
                productId: stockProductId,
                name: "Stoklu Ürün",
                quantity: 1,
                unitPrice: 100,
                vatRate: 20,
              },
            ],
            payments: [],
          },
        }),
      /Veresiye satış için müşteri seçmelisiniz/
    );

    const afterStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });
    assert.equal(Number(afterStock.stock), Number(beforeStock.stock));
  });

  it("D-F: kısmi + tam tahsilat paid/remaining ve PAID durumunu günceller", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const { applyCustomerCollection } = await import("./customer-balance-utils");
    const {
      derivePaymentStatus,
      getSaleRemainingAmount,
      recordSaleCollection,
      roundMoney,
    } = await import("./sale-payment-utils");

    const checkout = await executePosCheckout({
      companyId,
      userId,
      data: {
        idempotencyKey: randomUUID(),
        customerId,
        paymentStatus: "UNPAID",
        discount: 0,
        warehouseId,
        items: [
          {
            productId: stockProductId,
            name: "Stoklu Ürün",
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
          },
        ],
        payments: [],
      },
    });

    const saleId = checkout.sale.id;
    const total = Number(checkout.sale.total);
    const beforeBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    const beforeAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });

    await db.$transaction(async (tx) => {
      await recordSaleCollection(tx, {
        companyId,
        saleNo: checkout.sale.saleNo,
        amount: 50,
        accountId,
        note: `Cari tahsilat — Veresiye Müşteri · ${checkout.sale.saleNo}`,
      });
      await applyCustomerCollection(tx, companyId, customerId, 50);
      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: 50,
          paymentStatus: derivePaymentStatus(total, 50),
        },
      });
    });

    const partial = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(partial.paymentStatus, "PARTIAL");
    assert.equal(Number(partial.paidAmount), 50);
    assert.equal(getSaleRemainingAmount(total, Number(partial.paidAmount)), 70);

    await db.$transaction(async (tx) => {
      await recordSaleCollection(tx, {
        companyId,
        saleNo: checkout.sale.saleNo,
        amount: 70,
        accountId,
        note: `Cari tahsilat — Veresiye Müşteri · ${checkout.sale.saleNo}`,
      });
      await applyCustomerCollection(tx, companyId, customerId, 70);
      await tx.sale.update({
        where: { id: saleId },
        data: {
          paidAmount: total,
          paymentStatus: derivePaymentStatus(total, total),
        },
      });
    });

    const full = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(full.paymentStatus, "PAID");
    assert.equal(Number(full.paidAmount), total);

    const afterBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    assert.equal(
      roundMoney(Number(afterBalance.balance)),
      roundMoney(Number(beforeBalance.balance) - total)
    );

    const afterAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    assert.equal(
      roundMoney(Number(afterAccount.balance)),
      roundMoney(Number(beforeAccount.balance) + total)
    );
  });

  it("G: veresiye satış iptali cari borcu ve stoğu tersler", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const { cancelSaleById } = await import("./sale-cancel-service");

    const beforeStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });
    const beforeBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });

    const checkout = await executePosCheckout({
      companyId,
      userId,
      data: {
        idempotencyKey: randomUUID(),
        customerId,
        paymentStatus: "UNPAID",
        discount: 0,
        warehouseId,
        items: [
          {
            productId: stockProductId,
            name: "Stoklu Ürün",
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
          },
        ],
        payments: [],
      },
    });

    const cancelResult = await cancelSaleById(
      checkout.sale.id,
      companyId,
      userId,
      {
        reason: "Veresiye test iptali",
      }
    );
    assert.equal(cancelResult.ok, true);

    const cancelled = await db.sale.findUniqueOrThrow({
      where: { id: checkout.sale.id },
    });
    assert.equal(cancelled.status, "CANCELLED");

    const afterStock = await db.product.findUniqueOrThrow({
      where: { id: stockProductId },
      select: { stock: true },
    });
    assert.equal(Number(afterStock.stock), Number(beforeStock.stock));

    const afterBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    assert.equal(Number(afterBalance.balance), Number(beforeBalance.balance));
  });

  it("H: başka tenant müşterisiyle veresiye reddedilir", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const foreignCustomer = await db.customer.create({
      data: {
        companyId: otherCompanyId,
        name: "Yabancı Müşteri",
        status: "ACTIVE",
        balance: 0,
      },
    });

    await assert.rejects(() =>
      executePosCheckout({
        companyId,
        userId,
        data: {
          idempotencyKey: randomUUID(),
          customerId: foreignCustomer.id,
          paymentStatus: "UNPAID",
          discount: 0,
          items: [
            {
              productId: stockProductId,
              name: "Stoklu Ürün",
              quantity: 1,
              unitPrice: 100,
              vatRate: 20,
            },
          ],
          payments: [],
        },
      })
    );
  });

  it("parçalı nakit + cari: PARTIAL, kasa + borç", async () => {
    const { executePosCheckout } = await import("./pos-checkout-service");
    const beforeBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    const beforeAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });

    const result = await executePosCheckout({
      companyId,
      userId,
      data: {
        idempotencyKey: randomUUID(),
        customerId,
        paymentStatus: "PARTIAL",
        collectedAmount: 100,
        discount: 0,
        warehouseId,
        items: [
          {
            productId: stockProductId,
            name: "Stoklu Ürün",
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
          },
        ],
        payments: [
          {
            paymentMethod: "CASH",
            amount: 100,
            accountId,
          },
        ],
      },
    });

    assert.equal(result.sale.paymentStatus, "PARTIAL");
    assert.equal(Number(result.sale.paidAmount), 100);

    const afterBalance = await db.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { balance: true },
    });
    assert.equal(Number(afterBalance.balance), Number(beforeBalance.balance) + 20);

    const afterAccount = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { balance: true },
    });
    assert.equal(Number(afterAccount.balance), Number(beforeAccount.balance) + 100);
  });
});
