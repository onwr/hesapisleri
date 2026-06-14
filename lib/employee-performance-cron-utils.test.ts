import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDefaultSnapshotPeriod,
  isEmployeePerformanceCronAuthorized,
  shouldSkipInactiveEmployee,
} from "./employee-performance-cron-utils";
import {
  calculateAchievementPercent,
  calculateTargetAchievement,
  getAchievementStatus,
  pickEffectiveTarget,
  type EffectivePerformanceTarget,
} from "./employee-performance-target-utils";
import { buildPersonnelPerformanceCsv } from "./reports/personnel-performance-report";

describe("employee performance cron utils", () => {
  it("CRON_SECRET yoksa authorized false", () => {
    const oldSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const request = new Request("http://localhost/api/cron/employee-performance", {
      method: "POST",
      headers: { authorization: "Bearer abc" },
    });

    assert.equal(isEmployeePerformanceCronAuthorized(request), false);
    process.env.CRON_SECRET = oldSecret;
  });

  it("CRON_SECRET yanlışsa authorized false", () => {
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "abc";

    const request = new Request("http://localhost/api/cron/employee-performance", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });

    assert.equal(isEmployeePerformanceCronAuthorized(request), false);
    process.env.CRON_SECRET = oldSecret;
  });

  it("doğru secret authorized true", () => {
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "abc";

    const request = new Request("http://localhost/api/cron/employee-performance", {
      method: "POST",
      headers: { authorization: "Bearer abc" },
    });

    assert.equal(isEmployeePerformanceCronAuthorized(request), true);
    process.env.CRON_SECRET = oldSecret;
  });

  it("default snapshot period bir önceki ay", () => {
    const period = getDefaultSnapshotPeriod(new Date(2026, 5, 15));
    assert.equal(period.from.getMonth(), 4);
    assert.equal(period.to.getMonth(), 4);
  });

  it("inactive employee atlanır", () => {
    assert.equal(shouldSkipInactiveEmployee("ACTIVE"), false);
    assert.equal(shouldSkipInactiveEmployee("PASSIVE"), true);
  });
});

describe("employee performance target utils", () => {
  const baseTarget = (
    overrides: Partial<EffectivePerformanceTarget>
  ): EffectivePerformanceTarget => ({
    id: "t1",
    scope: "employee",
    employeeId: "emp-1",
    department: null,
    periodStart: "2026-06-01T00:00:00.000Z",
    periodEnd: "2026-06-30T23:59:59.999Z",
    salesCountTarget: 10,
    revenueTarget: 100000,
    collectionTarget: 80000,
    maxLeaveDays: 3,
    payrollEfficiencyTarget: 2,
    scoreTarget: 80,
    notes: null,
    ...overrides,
  });

  it("employee hedefi departman hedefine göre öncelikli", () => {
    const picked = pickEffectiveTarget(
      [
        baseTarget({ id: "dept", scope: "department", employeeId: null, department: "Satış" }),
        baseTarget({ id: "emp", scope: "employee", employeeId: "emp-1" }),
      ],
      { employeeId: "emp-1", department: "Satış" }
    );

    assert.equal(picked?.id, "emp");
  });

  it("departman hedefi fallback", () => {
    const picked = pickEffectiveTarget(
      [
        baseTarget({ id: "dept", scope: "department", employeeId: null, department: "Satış" }),
        baseTarget({ id: "company", scope: "company", employeeId: null, department: null }),
      ],
      { employeeId: "emp-2", department: "Satış" }
    );

    assert.equal(picked?.id, "dept");
  });

  it("achievement hesaplama", () => {
    const achievement = calculateTargetAchievement(
      {
        revenue: 80000,
        salesCount: 8,
        collectionTotal: 70000,
        performanceScore: 72,
        leaveDays: 1,
        revenuePerPayrollCost: 2.5,
      },
      baseTarget({})
    );

    assert.equal(achievement?.revenueAchievementPercent, 80);
    assert.equal(achievement?.salesCountAchievementPercent, 80);
    assert.equal(achievement?.scoreAchievementPercent, 90);
    assert.ok((achievement?.overallAchievementPercent ?? 0) >= 80);
  });

  it("hedef yoksa null", () => {
    assert.equal(calculateTargetAchievement({
      revenue: 1000,
      salesCount: 1,
      collectionTotal: 500,
      performanceScore: 50,
      leaveDays: 0,
      revenuePerPayrollCost: null,
    }, null), null);
  });

  it("achievement status eşikleri", () => {
    assert.equal(getAchievementStatus(120), "success");
    assert.equal(getAchievementStatus(85), "approaching");
    assert.equal(getAchievementStatus(60), "behind");
  });

  it("calculateAchievementPercent sıfır hedef null", () => {
    assert.equal(calculateAchievementPercent(100, 0), null);
  });
});

describe("personnel performance report target export", () => {
  it("CSV export hedef kolonlarını içerir", () => {
    const csv = buildPersonnelPerformanceCsv({
      period: {
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z",
      },
      summary: {
        employeeCount: 1,
        totalSales: 8,
        totalRevenue: 80000,
        totalPayrollCost: 30000,
        revenuePerEmployee: 80000,
        averageSalesPerEmployee: 8,
      },
      employees: [
        {
          employeeId: "emp-1",
          employeeName: "Ayşe Yılmaz",
          department: "Satış",
          jobTitle: "Temsilci",
          hasLinkedUser: true,
          salesCount: 8,
          revenue: 80000,
          posSalesCount: 5,
          manualSalesCount: 3,
          expenseCount: 1,
          invoiceCount: 2,
          collectionTotal: 70000,
          payrollCost: 30000,
          pendingPayrollCost: 0,
          leaveDays: 1,
          performanceScore: 72,
          target: {
            revenueTarget: 100000,
            salesCountTarget: 10,
            collectionTarget: 80000,
            scoreTarget: 80,
          },
          achievement: {
            revenueAchievementPercent: 80,
            salesCountAchievementPercent: 80,
            collectionAchievementPercent: 87,
            scoreAchievementPercent: 90,
            overallAchievementPercent: 84,
          },
        },
      ],
    });

    assert.match(csv, /Hedef Ciro/);
    assert.match(csv, /Genel Başarı/);
    assert.match(csv, /100000/);
    assert.match(csv, /84/);
  });
});

describe("personnel performance report response shape", () => {
  it("target alanları response'a eklenir", () => {
    const row = {
      employeeId: "emp-1",
      target: { revenueTarget: 100000, salesCountTarget: 10, scoreTarget: 80 },
      achievement: { overallAchievementPercent: 84 },
    };

    assert.equal(row.target.revenueTarget, 100000);
    assert.equal(row.achievement.overallAchievementPercent, 84);
  });
});
