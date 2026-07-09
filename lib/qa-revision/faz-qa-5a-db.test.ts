/**
 * QA Faz 5A — finansal metrik tutarlılığı (gerçek PostgreSQL test DB).
 * Production DB'ye bağlanmaz; yalnız hesapisleri_test.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildCanonicalFinancialSummary } from "@/lib/finance/financial-summary-service";
import { mapAccountTransactions } from "@/lib/finance-aggregation-utils";
import { resolveMonthFinancialPeriod } from "@/lib/finance/financial-period";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA 5A DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 5A — financial consistency DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerId: string;
  let accountAId: string;
  let accountA2Id: string;
  let accountBId: string;
  const stamp = `qa5a-${Date.now()}`;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const owner = await db.user.create({
      data: {
        email: `${stamp}@qa.internal`,
        password: hash,
        name: "QA 5A Owner",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerId = owner.id;

    const companyA = await db.company.create({
      data: { name: `QA5A_A_${stamp}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `QA5A_B_${stamp}`, status: "ACTIVE" },
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
        name: `QA5A Kasa ${stamp}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 50000,
        isDefault: true,
      },
    });
    accountAId = accountA.id;

    const accountA2 = await db.account.create({
      data: {
        companyId: companyAId,
        name: `QA5A Banka ${stamp}`,
        type: "BANK",
        status: "ACTIVE",
        currency: "TRY",
        balance: 10000,
      },
    });
    accountA2Id = accountA2.id;

    const accountB = await db.account.create({
      data: {
        companyId: companyBId,
        name: `QA5A Other ${stamp}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 99999,
      },
    });
    accountBId = accountB.id;

    const midMonth = new Date();
    midMonth.setDate(15);
    midMonth.setHours(12, 0, 0, 0);

    await db.sale.createMany({
      data: [
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-1`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 1000,
          vatTotal: 0,
          discount: 0,
          total: 1000,
          createdAt: midMonth,
          updatedAt: midMonth,
        },
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-2`,
          status: "CANCELLED",
          paymentStatus: "UNPAID",
          subtotal: 500,
          vatTotal: 0,
          discount: 0,
          total: 500,
          createdAt: midMonth,
          updatedAt: midMonth,
        },
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-svc`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 200,
          vatTotal: 0,
          discount: 0,
          total: 200,
          createdAt: midMonth,
          updatedAt: midMonth,
        },
      ],
    });

    await db.expense.createMany({
      data: [
        {
          companyId: companyAId,
          title: `QA5A paid ${stamp}`,
          amount: 300,
          date: midMonth,
          status: "APPROVED",
          paymentStatus: "PAID",
          category: "Ofis",
        },
        {
          companyId: companyAId,
          title: `QA5A unpaid ${stamp}`,
          amount: 150,
          date: midMonth,
          status: "APPROVED",
          paymentStatus: "UNPAID",
          category: "Ofis",
        },
        {
          companyId: companyAId,
          title: `QA5A cancelled ${stamp}`,
          amount: 80,
          date: midMonth,
          status: "CANCELLED",
          paymentStatus: "PAID",
          category: "Ofis",
        },
      ],
    });

    await db.accountTransaction.createMany({
      data: [
        {
          accountId: accountAId,
          type: "INCOME",
          title: `Satış Tahsilatı - SAT-${stamp}-1`,
          amount: 1000,
          date: midMonth,
        },
        {
          accountId: accountAId,
          type: "INCOME",
          title: `Manuel gelir ${stamp}`,
          amount: 100,
          date: midMonth,
        },
        {
          accountId: accountAId,
          type: "EXPENSE",
          title: `Kasa gideri ${stamp}`,
          amount: 50,
          date: midMonth,
        },
        {
          accountId: accountAId,
          type: "EXPENSE",
          title: `Satış İptali - SAT-${stamp}-x`,
          note: "[REVERSAL] satış iptal",
          amount: 334,
          date: midMonth,
        },
        {
          accountId: accountAId,
          type: "TRANSFER",
          title: "Transfer Çıkışı - Banka",
          amount: 400,
          date: midMonth,
        },
        {
          accountId: accountA2Id,
          type: "TRANSFER",
          title: "Transfer Girişi - Kasa",
          amount: 400,
          date: midMonth,
        },
        {
          accountId: accountBId,
          type: "INCOME",
          title: `Other tenant income ${stamp}`,
          amount: 50000,
          date: midMonth,
        },
      ],
    });
  });

  after(async () => {
    const companyIds = [companyAId, companyBId].filter(Boolean);
    await db.accountTransaction.deleteMany({
      where: { account: { companyId: { in: companyIds } } },
    });
    await db.expense.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.sale.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.user.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  });

  it("dashboard/reports/AI same cash P&L; profit = revenue - expense; mirrors/transfers excluded", async () => {
    const now = new Date();
    const period = resolveMonthFinancialPeriod({ referenceDate: now });
    const from = period.from;
    const to = period.toExclusive;

    const [txRows, expenses] = await Promise.all([
      db.accountTransaction.findMany({
        where: { account: { companyId: companyAId } },
        select: {
          id: true,
          date: true,
          createdAt: true,
          title: true,
          note: true,
          amount: true,
          type: true,
          expenseId: true,
        },
      }),
      db.expense.findMany({
        where: { companyId: companyAId },
        select: {
          amount: true,
          date: true,
          paymentStatus: true,
          status: true,
        },
      }),
    ]);

    const summary = buildCanonicalFinancialSummary(
      mapAccountTransactions(txRows),
      expenses,
      from,
      to,
      { toMode: "exclusive" }
    );

    assert.equal(summary.revenue.total, 1100);
    assert.equal(summary.expenses.cashTotal, 350);
    assert.equal(summary.adjustments.financeMirrorOutTotal, 334);
    assert.equal(summary.adjustments.transferInTotal, 400);
    assert.equal(summary.adjustments.transferOutTotal, 400);
    assert.equal(summary.profit.operational, 750);
    assert.equal(
      summary.profit.operational,
      summary.revenue.total - summary.expenses.cashTotal
    );
    assert.equal(summary.profit.cashNet, 416);
    assert.notEqual(
      summary.profit.operational,
      summary.profit.cashNet,
      "334 TL tipindeki fark: UI kârı operational, cashNet mirrors düşer"
    );

    const otherTx = await db.accountTransaction.findMany({
      where: { account: { companyId: companyBId } },
    });
    const otherSummary = buildCanonicalFinancialSummary(
      mapAccountTransactions(otherTx),
      [],
      from,
      to,
      { toMode: "exclusive" }
    );
    assert.equal(otherSummary.revenue.total, 50000);
  });

  it("cancelled sales excluded from accrual sales total", async () => {
    const now = new Date();
    const period = resolveMonthFinancialPeriod({ referenceDate: now });
    const from = period.from;
    const to = period.toExclusive;
    const { activeSaleStatusFilter } = await import("@/lib/sale-query-utils");
    const { sumSalesTotal } = await import("@/lib/dashboard-metrics");

    const sales = await db.sale.findMany({
      where: {
        companyId: companyAId,
        ...activeSaleStatusFilter(),
        createdAt: { gte: from, lt: to },
      },
      select: { total: true, createdAt: true, status: true },
    });

    assert.equal(sumSalesTotal(sales), 1200);
    assert.ok(sales.every((s) => s.status !== "CANCELLED"));
  });
});
