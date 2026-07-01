/**
 * QA Faz 3A — çalışan ödemesi, kasa seçimi ve avans muhasebesi DB testleri.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { calculateEmployeeBalance } from "@/lib/employee-utils";
import { calculateEmployeeAdvanceDebt } from "@/lib/employee-ledger-utils";
import { sumPaymentsByType } from "@/lib/payroll-utils";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 3A — employee payment finance DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerId: string;
  let employeeAId: string;
  let employeeBId: string;
  let accountAId: string;
  let accountBId: string;
  let salaryAId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const owner = await db.user.create({
      data: {
        email: `qa-faz3a-${Date.now()}@qa.internal`,
        password: hash,
        name: "QA Faz3A",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerId = owner.id;

    const companyA = await db.company.create({
      data: { name: `QA3A_A_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `QA3A_B_${Date.now()}`, status: "ACTIVE" },
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
        name: `QA Kasa A ${Date.now()}`,
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
        name: `QA Kasa B ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 5000,
        isDefault: true,
      },
    });
    accountBId = accountB.id;

    const employeeA = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "Ali",
        lastName: "Test",
        status: "ACTIVE",
      },
    });
    employeeAId = employeeA.id;

    const employeeB = await db.employee.create({
      data: {
        companyId: companyBId,
        firstName: "Veli",
        lastName: "Test",
        status: "ACTIVE",
      },
    });
    employeeBId = employeeB.id;

    const salary = await db.employeeSalary.create({
      data: {
        companyId: companyAId,
        employeeId: employeeAId,
        amount: 30000,
        currency: "TRY",
        effectiveFrom: new Date(2026, 0, 1),
        isActive: true,
      },
    });
    salaryAId = salary.id;
  });

  after(async () => {
    const companies = await db.company.findMany({
      where: { name: { startsWith: "QA3A_" } },
      select: { id: true },
    });
    const companyIds = companies.map((c) => c.id);

    if (companyIds.length > 0) {
      await db.payrollRunItem.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.payrollRun.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.employeePayment.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.employeeSalary.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.expense.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.accountTransaction.deleteMany({
        where: { account: { companyId: { in: companyIds } } },
      });
      await db.employee.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.account.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.activityLog.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.companyUser.deleteMany({ where: { companyId: { in: companyIds } } });
      await db.company.deleteMany({ where: { id: { in: companyIds } } });
    }

    if (ownerId) {
      await db.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    }

    await db.$disconnect();
  });

  it("avans → hesap bakiyesi azalır ve atomik kayıtlar oluşur", async () => {
    const { createEmployeePayment } = await import("@/lib/employee-service");
    const beforeBalance = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );

    const payment = await createEmployeePayment({
      companyId: companyAId,
      actorUserId: ownerId,
      employeeId: employeeAId,
      type: "ADVANCE",
      amount: 2000,
      relatedAccountId: accountAId,
      payImmediately: true,
    });

    assert.equal(payment.status, "PAID");
    assert.ok(payment.relatedTransactionId);
    assert.ok(payment.relatedExpenseId);

    const afterBalance = Number(
      (await db.account.findUniqueOrThrow({ where: { id: accountAId } })).balance
    );
    assert.equal(afterBalance, beforeBalance - 2000);

    const txCount = await db.accountTransaction.count({
      where: { id: payment.relatedTransactionId! },
    });
    assert.equal(txCount, 1);
  });

  it("avans → çalışan avans borcu artar, payable artmaz", async () => {
    const payments = await db.employeePayment.findMany({
      where: { companyId: companyAId, employeeId: employeeAId, type: "ADVANCE" },
    });

    const balance = calculateEmployeeBalance(payments);
    const advanceDebt = calculateEmployeeAdvanceDebt(payments);

    assert.equal(balance.totalPaid, 0);
    assert.ok(advanceDebt >= 2000);
  });

  it("foreign account reddi", async () => {
    const { createEmployeePayment, EmployeeServiceError } = await import(
      "@/lib/employee-service"
    );

    await assert.rejects(
      () =>
        createEmployeePayment({
          companyId: companyAId,
          actorUserId: ownerId,
          employeeId: employeeAId,
          type: "BONUS",
          amount: 500,
          relatedAccountId: accountBId,
          payImmediately: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EmployeeServiceError);
        assert.match(error.message, /firmaya ait değil/);
        return true;
      }
    );
  });

  it("foreign employee reddi", async () => {
    const { createEmployeePayment, EmployeeServiceError } = await import(
      "@/lib/employee-service"
    );

    await assert.rejects(
      () =>
        createEmployeePayment({
          companyId: companyAId,
          actorUserId: ownerId,
          employeeId: employeeBId,
          type: "BONUS",
          amount: 500,
          relatedAccountId: accountAId,
          payImmediately: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EmployeeServiceError);
        assert.match(error.message, /bulunamadı/);
        return true;
      }
    );
  });

  it("yetersiz bakiye rollback — EmployeePayment kalmaz", async () => {
    const { createEmployeePayment, EmployeeServiceError } = await import(
      "@/lib/employee-service"
    );

    const lowBalanceAccount = await db.account.create({
      data: {
        companyId: companyAId,
        name: `QA Düşük ${Date.now()}`,
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        balance: 50,
      },
    });

    const beforeCount = await db.employeePayment.count({
      where: { companyId: companyAId, employeeId: employeeAId, amount: 9999 },
    });

    await assert.rejects(
      () =>
        createEmployeePayment({
          companyId: companyAId,
          actorUserId: ownerId,
          employeeId: employeeAId,
          type: "BONUS",
          amount: 9999,
          relatedAccountId: lowBalanceAccount.id,
          payImmediately: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof EmployeeServiceError);
        assert.match(error.message, /yeterli bakiye/);
        return true;
      }
    );

    const afterCount = await db.employeePayment.count({
      where: { companyId: companyAId, employeeId: employeeAId, amount: 9999 },
    });
    assert.equal(afterCount, beforeCount);

    await db.account.delete({ where: { id: lowBalanceAccount.id } });
  });

  it("bordro net payable avansı düşer", async () => {
    const periodStart = new Date(2026, 0, 1);
    const periodEnd = new Date(2026, 11, 31, 23, 59, 59);

    const payments = await db.employeePayment.findMany({
      where: {
        companyId: companyAId,
        employeeId: employeeAId,
        type: "ADVANCE",
        status: "PAID",
      },
    });
    assert.ok(payments.length > 0, "ödenmiş avans kaydı olmalı");

    const advanceDeduction = sumPaymentsByType(
      payments,
      "ADVANCE",
      periodStart,
      periodEnd
    );

    assert.ok(advanceDeduction >= 2000);

    const { calculatePayrollItemNetPayable } = await import("@/lib/payroll-utils");
    const netPayable = calculatePayrollItemNetPayable({
      baseSalary: 30000,
      bonusAmount: 0,
      deductionAmount: 0,
      advanceDeduction,
    });
    assert.ok(netPayable < 30000);
    assert.equal(netPayable, 30000 - advanceDeduction);
  });

  it("maaş ödeme doğru accountTransaction oluşturur", async () => {
    const { createEmployeePayment } = await import("@/lib/employee-service");

    const payment = await createEmployeePayment({
      companyId: companyAId,
      actorUserId: ownerId,
      employeeId: employeeAId,
      type: "SALARY",
      amount: 1500,
      relatedAccountId: accountAId,
      payImmediately: true,
    });

    assert.equal(payment.status, "PAID");
    const tx = await db.accountTransaction.findFirst({
      where: { id: payment.relatedTransactionId! },
    });
    assert.ok(tx);
    assert.equal(Number(tx!.amount), 1500);
  });

  it("ActivityLog doğru company scope", async () => {
    const log = await db.activityLog.findFirst({
      where: {
        companyId: companyAId,
        module: "employees",
        action: "PAYMENT_PAID",
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(log);
    assert.equal(log!.companyId, companyAId);
  });
});
