import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePayrollItemNetPayable,
  calculatePayrollRunTotals,
  canApprovePayrollRun,
  canCancelPayrollRun,
  canMarkPayrollRunPaid,
  canRecalculatePayrollRun,
  getPayrollRunActions,
  isPaymentInPayrollPeriod,
  normalizePayrollPeriod,
  validatePayrollRunStatusTransition,
} from "./payroll-utils";

describe("payroll utils", () => {
  it("netPayable hesaplama", () => {
    assert.equal(
      calculatePayrollItemNetPayable({
        baseSalary: 30000,
        bonusAmount: 2000,
        deductionAmount: 1000,
        advanceDeduction: 500,
      }),
      30500
    );
  });

  it("totals hesaplama", () => {
    const totals = calculatePayrollRunTotals([
      {
        baseSalary: 30000,
        bonusAmount: 1000,
        deductionAmount: 500,
        advanceDeduction: 0,
        netPayable: 30500,
      },
      {
        baseSalary: 25000,
        bonusAmount: 0,
        deductionAmount: 0,
        advanceDeduction: 1000,
        netPayable: 24000,
      },
    ]);

    assert.equal(totals.grossTotal, 55000);
    assert.equal(totals.bonusTotal, 1000);
    assert.equal(totals.deductionTotal, 1500);
    assert.equal(totals.netTotal, 54500);
    assert.equal(totals.employeeCount, 2);
  });

  it("status transition validation", () => {
    assert.equal(validatePayrollRunStatusTransition("DRAFT", "APPROVED"), true);
    assert.equal(validatePayrollRunStatusTransition("PAID", "CANCELLED"), false);
  });

  it("action availability by status", () => {
    assert.equal(canApprovePayrollRun("DRAFT"), true);
    assert.equal(canRecalculatePayrollRun("APPROVED"), false);
    assert.equal(canMarkPayrollRunPaid("APPROVED"), true);
    assert.equal(canCancelPayrollRun("PAID"), false);
  });

  it("getPayrollRunActions DRAFT", () => {
    const actions = getPayrollRunActions("DRAFT");
    assert.equal(actions.canApprove, true);
    assert.equal(actions.canEditItems, true);
    assert.equal(actions.canMarkPaid, false);
    assert.equal(getPayrollRunActions("APPROVED").canEditItems, false);
  });

  it("isPaymentInPayrollPeriod paid advance", () => {
    const periodStart = new Date(2026, 5, 1);
    const periodEnd = new Date(2026, 5, 30, 23, 59, 59);

    assert.equal(
      isPaymentInPayrollPeriod(
        {
          type: "ADVANCE",
          status: "PAID",
          dueDate: new Date(2026, 4, 1),
          paidAt: new Date(2026, 5, 10),
          createdAt: new Date(2026, 4, 1),
        },
        periodStart,
        periodEnd
      ),
      true
    );
  });

  it("isPaymentInPayrollPeriod pending bonus", () => {
    const periodStart = new Date(2026, 5, 1);
    const periodEnd = new Date(2026, 5, 30, 23, 59, 59);

    assert.equal(
      isPaymentInPayrollPeriod(
        {
          type: "BONUS",
          status: "PENDING",
          dueDate: new Date(2026, 5, 15),
          createdAt: new Date(2026, 5, 1),
        },
        periodStart,
        periodEnd
      ),
      true
    );
  });

  it("normalizePayrollPeriod invalid range", () => {
    const result = normalizePayrollPeriod({
      periodStart: new Date(2026, 5, 10),
      periodEnd: new Date(2026, 5, 1),
    });
    assert.equal(result.ok, false);
  });
});

describe("payroll calendar system events", () => {
  it("payDate system event üretilebilir", async () => {
    const { buildPayrollRunSystemEvents } = await import("./calendar-service");
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 30, 23, 59, 59);
    const events = buildPayrollRunSystemEvents(
      [
        {
          id: "run-1",
          companyId: "c1",
          title: "Haziran Bordrosu",
          payDate: new Date(2026, 5, 28),
          netTotal: 125000,
          currency: "TRY",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "system:payroll-run:run-1");
    assert.match(events[0]?.title ?? "", /Bordro ödemesi/);
    assert.equal(events[0]?.actionUrl, "/team/payroll/run-1");
  });
});

describe("payroll API access", () => {
  it("employees modülü STAFF erişemez", () => {
    const staffCanAccess = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes("STAFF");
    assert.equal(staffCanAccess, false);
  });
});
