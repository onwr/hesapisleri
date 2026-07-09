/**
 * QA Faz 5A.1 — financial labels + Istanbul half-open period (test DB).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildCanonicalFinancialSummary } from "@/lib/finance/financial-summary-service";
import {
  CASH_RESULT_LABEL,
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  resolveMonthFinancialPeriod,
  zonedWallTimeToUtc,
} from "@/lib/finance/financial-period";
import { mapAccountTransactions } from "@/lib/finance-aggregation-utils";
import { buildMonthlyCashFlowData } from "@/lib/finance-aggregation-utils";
import { buildDailySalesChart } from "@/lib/dashboard-metrics";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA 5A.1 DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 5A.1 — financial labels & period DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerId: string;
  let accountAId: string;
  const stamp = `qa5a1-${Date.now()}`;

  const julyFrom = resolveMonthFinancialPeriod({
    referenceDate: new Date("2026-07-15T12:00:00+03:00"),
    timezone: COMPANY_FINANCE_TIMEZONE,
  });

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
        name: "QA 5A.1",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerId = owner.id;

    const companyA = await db.company.create({
      data: { name: `QA5A1_A_${stamp}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;
    const companyB = await db.company.create({
      data: { name: `QA5A1_B_${stamp}`, status: "ACTIVE" },
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
        name: `QA5A1 Kasa ${stamp}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 20000,
        isDefault: true,
      },
    });
    accountAId = accountA.id;

    const accountB = await db.account.create({
      data: {
        companyId: companyBId,
        name: `QA5A1 Other ${stamp}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 1000,
      },
    });

    // Boundary: July 1 00:00 Istanbul (= previous day 21:00 UTC)
    const julyStart = julyFrom.from;
    // Last ms of July Istanbul
    const julyLastMs = julyFrom.toInclusive;
    // Aug 1 Istanbul midnight — out of range
    const augStart = julyFrom.toExclusive;

    // createdAt vs saleDate diverge
    const createdInJuly = zonedWallTimeToUtc({
      year: 2026,
      month: 7,
      day: 10,
      hour: 12,
    });
    const saleDateInJune = zonedWallTimeToUtc({
      year: 2026,
      month: 6,
      day: 28,
      hour: 12,
    });

    await db.sale.createMany({
      data: [
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-bound1`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 111,
          vatTotal: 0,
          discount: 0,
          total: 111,
          createdAt: julyStart,
          saleDate: julyStart,
          updatedAt: julyStart,
        },
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-bound2`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 222,
          vatTotal: 0,
          discount: 0,
          total: 222,
          createdAt: julyLastMs,
          saleDate: julyLastMs,
          updatedAt: julyLastMs,
        },
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-aug`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 999,
          vatTotal: 0,
          discount: 0,
          total: 999,
          createdAt: augStart,
          saleDate: augStart,
          updatedAt: augStart,
        },
        {
          companyId: companyAId,
          userId: ownerId,
          saleNo: `SAT-${stamp}-date-diff`,
          status: "COMPLETED",
          paymentStatus: "PAID",
          subtotal: 50,
          vatTotal: 0,
          discount: 0,
          total: 50,
          createdAt: createdInJuly,
          saleDate: saleDateInJune,
          updatedAt: createdInJuly,
        },
      ],
    });

    await db.expense.createMany({
      data: [
        {
          companyId: companyAId,
          title: `paid ${stamp}`,
          amount: 40,
          date: createdInJuly,
          status: "APPROVED",
          paymentStatus: "PAID",
          category: "Ofis",
        },
        {
          companyId: companyAId,
          title: `unpaid ${stamp}`,
          amount: 60,
          date: createdInJuly,
          status: "APPROVED",
          paymentStatus: "UNPAID",
          category: "Ofis",
        },
      ],
    });

    await db.accountTransaction.createMany({
      data: [
        {
          accountId: accountAId,
          type: "INCOME",
          title: `Satış Tahsilatı - ${stamp}`,
          amount: 400,
          date: createdInJuly,
        },
        {
          accountId: accountAId,
          type: "EXPENSE",
          title: `Kasa gideri ${stamp}`,
          amount: 25,
          date: createdInJuly,
        },
        {
          accountId: accountAId,
          type: "TRANSFER",
          title: "Transfer Çıkışı - Banka",
          amount: 70,
          date: createdInJuly,
        },
        {
          accountId: accountB.id,
          type: "INCOME",
          title: `Other ${stamp}`,
          amount: 8888,
          date: createdInJuly,
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

  it("half-open Istanbul: July start/end boundaries; Aug excluded", async () => {
    const { activeSaleStatusFilter } = await import("@/lib/sale-query-utils");
    const { sumSalesTotal } = await import("@/lib/dashboard-metrics");

    const sales = await db.sale.findMany({
      where: {
        companyId: companyAId,
        ...activeSaleStatusFilter(),
        createdAt: { gte: julyFrom.from, lt: julyFrom.toExclusive },
      },
      select: { total: true, createdAt: true, saleNo: true },
    });

    // 111 + 222 + 50 (date-diff by createdAt) ; aug 999 excluded
    assert.equal(sumSalesTotal(sales), 383);
    assert.ok(sales.every((s) => !s.saleNo.includes("-aug")));
    assert.ok(
      sales.some((s) => isInHalfOpenRange(s.createdAt, julyFrom.from, julyFrom.toExclusive))
    );
  });

  it("createdAt metric includes July-created June-saleDate; saleDate metric would differ", async () => {
    const { activeSaleStatusFilter } = await import("@/lib/sale-query-utils");
    const byCreated = await db.sale.findMany({
      where: {
        companyId: companyAId,
        ...activeSaleStatusFilter(),
        createdAt: { gte: julyFrom.from, lt: julyFrom.toExclusive },
        saleNo: { contains: "date-diff" },
      },
    });
    const bySaleDate = await db.sale.findMany({
      where: {
        companyId: companyAId,
        ...activeSaleStatusFilter(),
        saleDate: { gte: julyFrom.from, lt: julyFrom.toExclusive },
        saleNo: { contains: "date-diff" },
      },
    });
    assert.equal(byCreated.length, 1);
    assert.equal(bySaleDate.length, 0);
  });

  it("cash result label + accrual profit separate; chart = KPI; tenant isolation", async () => {
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

    const accrualSales = 383;
    const summary = buildCanonicalFinancialSummary(
      mapAccountTransactions(txRows),
      expenses,
      julyFrom.from,
      julyFrom.toExclusive,
      { toMode: "exclusive", accrualSalesTotal: accrualSales }
    );

    assert.equal(summary.profit.label, CASH_RESULT_LABEL);
    assert.equal(summary.revenue.total, 400);
    assert.equal(summary.expenses.cashTotal, 65); // 40 paid expense + 25 manual
    assert.equal(summary.profit.operational, 335);
    assert.equal(summary.profit.accrual, 383 - 100); // accrued = paid+unpaid = 100
    assert.notEqual(summary.profit.operational, summary.profit.accrual);

    const buckets = buildMonthlyCashFlowData(
      mapAccountTransactions(txRows),
      expenses,
      julyFrom.from,
      julyFrom.toExclusive,
      6,
      { toMode: "exclusive" }
    );
    assert.equal(
      buckets.reduce((s, b) => s + b.income, 0),
      summary.revenue.total
    );
    assert.equal(
      buckets.reduce((s, b) => s + b.expense, 0),
      summary.expenses.cashTotal
    );

    const salesRows = await db.sale.findMany({
      where: {
        companyId: companyAId,
        createdAt: { gte: julyFrom.from, lt: julyFrom.toExclusive },
        status: { not: "CANCELLED" },
      },
      select: { total: true, createdAt: true },
    });
    const chart = buildDailySalesChart(
      salesRows,
      julyFrom.from,
      julyFrom.toExclusive
    );
    assert.equal(
      chart.reduce((s, p) => s + p.amount, 0),
      salesRows.reduce((s, r) => s + Number(r.total), 0)
    );

    const otherTx = await db.accountTransaction.findMany({
      where: { account: { companyId: companyBId } },
    });
    const other = buildCanonicalFinancialSummary(
      mapAccountTransactions(otherTx),
      [],
      julyFrom.from,
      julyFrom.toExclusive,
      { toMode: "exclusive" }
    );
    assert.equal(other.revenue.total, 8888);
  });

  it("cash expense link tab=paid documents intent in dashboard source", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "lib/dashboard-page-data.ts"),
      "utf8"
    );
    assert.match(src, /tab:\s*"paid"/);
    assert.match(src, /CASH_RESULT_LABEL/);
  });
});
