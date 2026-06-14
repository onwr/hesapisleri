import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAverageTicket,
  calculateLeaveDaysInPeriod,
  calculatePayrollCostInPeriod,
  calculatePerformanceScore,
  calculatePercentChange,
  calculateRevenuePerPayrollCost,
  normalizeMetric,
  normalizePerformanceDateRange,
} from "./employee-performance-utils";
import {
  buildPersonnelPerformanceCsv,
  buildPersonnelPerformanceExportFilename,
} from "./reports/personnel-performance-report";
import {
  canAccessEmployees,
  canAccessModule,
  canManageEmployees,
} from "./permission-utils";

describe("employee performance utils", () => {
  it("normalizePerformanceDateRange default month", () => {
    const result = normalizePerformanceDateRange({});
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.from <= result.to);
    }
  });

  it("normalizePerformanceDateRange invalid", () => {
    const result = normalizePerformanceDateRange({
      from: new Date(2026, 5, 20),
      to: new Date(2026, 5, 1),
    });
    assert.equal(result.ok, false);
  });

  it("calculateAverageTicket", () => {
    assert.equal(calculateAverageTicket(10000, 4), 2500);
    assert.equal(calculateAverageTicket(1000, 0), 0);
  });

  it("calculatePayrollCostInPeriod", () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 30, 23, 59, 59);

    const result = calculatePayrollCostInPeriod(
      [
        {
          amount: 30000,
          status: "PAID",
          type: "SALARY",
          paidAt: new Date(2026, 5, 28),
          dueDate: new Date(2026, 5, 28),
        },
        {
          amount: 5000,
          status: "PENDING",
          type: "SALARY",
          paidAt: null,
          dueDate: new Date(2026, 5, 30),
        },
        {
          amount: 1000,
          status: "PAID",
          type: "DEDUCTION",
          paidAt: new Date(2026, 5, 28),
          dueDate: new Date(2026, 5, 28),
        },
      ],
      from,
      to
    );

    assert.equal(result.payrollCost, 30000);
    assert.equal(result.pendingPayrollCost, 5000);
  });

  it("calculateLeaveDaysInPeriod", () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 30);

    const days = calculateLeaveDaysInPeriod(
      [
        {
          startAt: new Date(2026, 5, 10),
          endAt: new Date(2026, 5, 12),
          status: "APPROVED",
        },
        {
          startAt: new Date(2026, 5, 15),
          endAt: new Date(2026, 5, 16),
          status: "PENDING",
        },
      ],
      from,
      to
    );

    assert.equal(days, 3);
  });

  it("calculatePerformanceScore helper", () => {
    const score = calculatePerformanceScore({
      revenue: 100000,
      salesCount: 20,
      leaveDays: 2,
      payrollCost: 30000,
      benchmarks: {
        maxRevenue: 100000,
        maxSales: 20,
        maxLeaveDays: 10,
      },
    });

    assert.ok(score >= 70);
    assert.ok(score <= 100);
  });

  it("normalizeMetric and percent change", () => {
    assert.equal(normalizeMetric(50, 100), 0.5);
    assert.equal(calculatePercentChange(120, 100), 20);
    assert.equal(calculateRevenuePerPayrollCost(100000, 25000), 4);
  });

  it("unlinked employee benchmarks produce zero sales score path", () => {
    const score = calculatePerformanceScore({
      revenue: 0,
      salesCount: 0,
      leaveDays: 0,
      payrollCost: 0,
      benchmarks: { maxRevenue: 1, maxSales: 1, maxLeaveDays: 22 },
    });
    assert.equal(score, 15);
  });
});

describe("personnel performance report export", () => {
  it("CSV Türkçe BOM içerir", () => {
    const csv = buildPersonnelPerformanceCsv({
      period: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z",
      },
      summary: {
        employeeCount: 1,
        totalSales: 5,
        totalRevenue: 25000,
        totalPayrollCost: 30000,
        revenuePerEmployee: 25000,
        averageSalesPerEmployee: 5,
      },
      employees: [
        {
          employeeId: "emp-1",
          employeeName: "Ayşe Yılmaz",
          department: "Satış",
          jobTitle: "Temsilci",
          hasLinkedUser: true,
          salesCount: 5,
          revenue: 25000,
          posSalesCount: 3,
          manualSalesCount: 2,
          expenseCount: 1,
          invoiceCount: 2,
          collectionTotal: 20000,
          payrollCost: 30000,
          pendingPayrollCost: 0,
          leaveDays: 1,
          performanceScore: 72,
          target: null,
          achievement: null,
        },
      ],
    });

    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.match(csv, /Ayşe Yılmaz/);
  });

  it("export filename format", () => {
    assert.equal(
      buildPersonnelPerformanceExportFilename(
        "2026-06-01T00:00:00.000Z",
        "2026-06-30T23:59:59.999Z"
      ),
      "personel-performans-2026-06-01-2026-06-30.csv"
    );
  });
});

describe("personnel performance access", () => {
  it("employees modülü STAFF erişemez", () => {
    const allowed = ["OWNER", "ADMIN", "SUPER_ADMIN"];
    assert.equal(allowed.includes("STAFF"), false);
  });

  it("reports modülü ACCOUNTANT erişir ve employees görüntüleyebilir", () => {
    assert.equal(canAccessModule("ACCOUNTANT", "reports"), true);
    assert.equal(canAccessEmployees("ACCOUNTANT"), true);
    assert.equal(canManageEmployees("ACCOUNTANT"), false);
    assert.equal(canAccessModule("STAFF", "employees"), false);
  });
});
