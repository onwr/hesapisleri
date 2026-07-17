/**
 * Satış fişi — gerçek DB integration testleri.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: sale receipt DB tests require TEST_DATABASE_URL pointing to a _test database";

describe("satış fişi — gerçek DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyId: string;
  let otherCompanyId: string;
  let userId: string;
  let customerId: string;
  let cashAccountId: string;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");
    const stamp = `sale-receipt-${Date.now()}`;

    const owner = await db.user.create({
      data: {
        email: `${stamp}-owner@qa.internal`,
        password: hash,
        name: "Receipt Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    userId = owner.id;
    userIds.push(owner.id);

    const company = await db.company.create({
      data: {
        name: `Receipt Co ${stamp}`,
        status: "ACTIVE",
        phone: "02120000000",
        taxNo: "1234567890",
        taxOffice: "Kadıköy",
        address: "İstanbul",
      },
    });
    companyId = company.id;
    companyIds.push(company.id);

    const other = await db.company.create({
      data: { name: `Receipt Other ${stamp}`, status: "ACTIVE" },
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

    const customer = await db.customer.create({
      data: {
        companyId,
        name: "Fiş Müşteri",
        status: "ACTIVE",
        balance: 0,
      },
    });
    customerId = customer.id;

    const cash = await db.account.create({
      data: {
        companyId,
        name: "Nakit Kasa",
        type: "CASH",
        balance: 0,
        currency: "TRY",
        status: "ACTIVE",
      },
    });
    cashAccountId = cash.id;
  });

  after(async () => {
    await db.salePayment.deleteMany({
      where: { companyId: { in: companyIds } },
    });
    await db.saleItem.deleteMany({
      where: { sale: { companyId: { in: companyIds } } },
    });
    await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  it("kendi tenant satışını okur; başka tenant reddedilir", async () => {
    const { getSaleReceiptData, SaleReceiptNotFoundError } = await import(
      "./sale-receipt-data"
    );

    const sale = await db.sale.create({
      data: {
        companyId,
        userId,
        saleNo: `R-OWN-${randomUUID().slice(0, 8)}`,
        subtotal: 100,
        vatTotal: 20,
        discount: 0,
        total: 120,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paidAmount: 120,
        items: {
          create: [
            {
              name: "Ürün A",
              quantity: 1,
              unitPrice: 100,
              vatRate: 20,
              total: 120,
            },
          ],
        },
        payments: {
          create: [
            {
              companyId,
              accountId: cashAccountId,
              paymentMethod: "CASH",
              amount: 120,
            },
          ],
        },
      },
    });

    const receipt = await getSaleReceiptData({
      companyId,
      saleId: sale.id,
    });
    assert.equal(receipt.saleNo, sale.saleNo);
    assert.match(receipt.paymentLines[0]?.label ?? "", /Nakit/);

    await assert.rejects(
      () =>
        getSaleReceiptData({
          companyId: otherCompanyId,
          saleId: sale.id,
        }),
      (error: unknown) => error instanceof SaleReceiptNotFoundError
    );
  });

  it("veresiye ve parçalı ödemeyi fişte gösterir", async () => {
    const { getSaleReceiptData } = await import("./sale-receipt-data");

    const unpaid = await db.sale.create({
      data: {
        companyId,
        userId,
        customerId,
        saleNo: `R-UNP-${randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        vatTotal: 0,
        discount: 0,
        total: 1000,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        items: {
          create: [
            {
              name: "Veresiye Ürün",
              quantity: 1,
              unitPrice: 1000,
              vatRate: 0,
              total: 1000,
            },
          ],
        },
      },
    });

    const unpaidReceipt = await getSaleReceiptData({
      companyId,
      saleId: unpaid.id,
    });
    assert.equal(unpaidReceipt.customerName, "Fiş Müşteri");
    assert.equal(unpaidReceipt.remainingAmount, 1000);
    assert.ok(
      unpaidReceipt.paymentLines.some((line) =>
        line.label.includes("Cari'ye Yaz")
      )
    );

    const partial = await db.sale.create({
      data: {
        companyId,
        userId,
        customerId,
        saleNo: `R-PAR-${randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        vatTotal: 0,
        discount: 0,
        total: 1000,
        status: "COMPLETED",
        paymentStatus: "PARTIAL",
        paidAmount: 400,
        items: {
          create: [
            {
              name: "Parçalı Ürün",
              quantity: 1,
              unitPrice: 1000,
              vatRate: 0,
              total: 1000,
            },
          ],
        },
        payments: {
          create: [
            {
              companyId,
              accountId: cashAccountId,
              paymentMethod: "CASH",
              amount: 400,
            },
          ],
        },
      },
    });

    const partialReceipt = await getSaleReceiptData({
      companyId,
      saleId: partial.id,
    });
    assert.equal(partialReceipt.paidAmount, 400);
    assert.equal(partialReceipt.remainingAmount, 600);
    assert.equal(partialReceipt.paymentLines.length, 2);
  });

  it("SERVICE ürün ve iptal etiketini gösterir", async () => {
    const { getSaleReceiptData } = await import("./sale-receipt-data");

    const serviceSale = await db.sale.create({
      data: {
        companyId,
        userId,
        saleNo: `R-SVC-${randomUUID().slice(0, 8)}`,
        subtotal: 200,
        vatTotal: 40,
        discount: 0,
        total: 240,
        status: "CANCELLED",
        paymentStatus: "PAID",
        paidAmount: 240,
        items: {
          create: [
            {
              name: "Montaj Hizmeti",
              quantity: 1,
              unitPrice: 200,
              vatRate: 20,
              total: 240,
            },
          ],
        },
      },
    });

    const receipt = await getSaleReceiptData({
      companyId,
      saleId: serviceSale.id,
    });
    assert.equal(receipt.isCancelled, true);
    assert.equal(receipt.items[0]?.name, "Montaj Hizmeti");
  });
});
