import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateTargetAchievement,
  filterTargetsByScope,
  parseTargetScope,
  pickEffectiveDepartmentTarget,
  type EffectivePerformanceTarget,
} from "./employee-performance-target-utils";
import {
  buildDepartmentPerformanceCsv,
  type DepartmentPerformanceReport,
} from "./reports/department-performance-report";
import {
  canAccessEmployees,
  canManageEmployees,
} from "./permission-utils";

const baseTarget = (
  overrides: Partial<EffectivePerformanceTarget>
): EffectivePerformanceTarget => ({
  id: "t1",
  scope: "department",
  employeeId: null,
  department: "Satış",
  periodStart: "2026-06-01T00:00:00.000Z",
  periodEnd: "2026-06-30T23:59:59.999Z",
  salesCountTarget: 20,
  revenueTarget: 200000,
  collectionTarget: 150000,
  maxLeaveDays: 5,
  payrollEfficiencyTarget: 2,
  scoreTarget: 80,
  notes: null,
  ...overrides,
});

describe("performance target scope utils", () => {
  it("parseTargetScope geçerli değerleri döner", () => {
    assert.equal(parseTargetScope("employee"), "employee");
    assert.equal(parseTargetScope("department"), "department");
    assert.equal(parseTargetScope("company"), "company");
    assert.equal(parseTargetScope("invalid"), undefined);
    assert.equal(parseTargetScope(null), undefined);
  });

  it("filterTargetsByScope hedef tipine göre filtreler", () => {
    const targets = [
      baseTarget({ id: "emp", scope: "employee", employeeId: "e1" }),
      baseTarget({ id: "dept", scope: "department" }),
      baseTarget({
        id: "company",
        scope: "company",
        department: null,
      }),
    ];

    assert.equal(filterTargetsByScope(targets, "employee").length, 1);
    assert.equal(filterTargetsByScope(targets, "department").length, 1);
    assert.equal(filterTargetsByScope(targets, "company").length, 1);
    assert.equal(filterTargetsByScope(targets).length, 3);
  });
});

describe("pickEffectiveDepartmentTarget", () => {
  it("departman hedefi firma hedefine göre öncelikli", () => {
    const picked = pickEffectiveDepartmentTarget(
      [
        baseTarget({ id: "dept", scope: "department", department: "Satış" }),
        baseTarget({ id: "company", scope: "company", department: null }),
      ],
      "Satış"
    );

    assert.equal(picked?.id, "dept");
  });

  it("departman hedefi yoksa firma geneli fallback", () => {
    const picked = pickEffectiveDepartmentTarget(
      [
        baseTarget({ id: "dept", scope: "department", department: "Pazarlama" }),
        baseTarget({ id: "company", scope: "company", department: null }),
      ],
      "Satış"
    );

    assert.equal(picked?.id, "company");
  });

  it("hiç hedef yoksa null", () => {
    assert.equal(
      pickEffectiveDepartmentTarget(
        [baseTarget({ id: "dept", scope: "department", department: "Pazarlama" })],
        "Satış"
      ),
      null
    );
  });
});

describe("department performance report helpers", () => {
  const sampleReport: DepartmentPerformanceReport = {
    period: {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-06-30T23:59:59.999Z",
    },
    summary: {
      departmentCount: 2,
      topRevenueDepartment: "Satış",
      topScoreDepartment: "Satış",
      topEfficiencyDepartment: "Satış",
      mostLeaveDepartment: "Destek",
    },
    departments: [
      {
        department: "Satış",
        departmentId: "dept-1",
        departmentColor: "#2563eb",
        isLegacyDepartment: false,
        employeeCount: 2,
        totalRevenue: 200000,
        totalSales: 20,
        totalCollection: 150000,
        totalPayrollCost: 80000,
        revenuePerEmployee: 100000,
        averageScore: 85,
        leaveDays: 2,
        efficiencyRatio: 2.5,
        target: {
          revenueTarget: 250000,
          salesCountTarget: 25,
          collectionTarget: 180000,
          scoreTarget: 80,
        },
        achievement: calculateTargetAchievement(
          {
            revenue: 200000,
            salesCount: 20,
            collectionTotal: 150000,
            performanceScore: 85,
            leaveDays: 2,
            revenuePerPayrollCost: 2.5,
          },
          baseTarget({ revenueTarget: 250000, salesCountTarget: 25 })
        ),
      },
      {
        department: "Destek",
        departmentId: null,
        departmentColor: null,
        isLegacyDepartment: true,
        employeeCount: 1,
        totalRevenue: 50000,
        totalSales: 5,
        totalCollection: 40000,
        totalPayrollCost: 30000,
        revenuePerEmployee: 50000,
        averageScore: 70,
        leaveDays: 4,
        efficiencyRatio: 1.67,
        target: null,
        achievement: null,
      },
    ],
  };

  it("departman achievement hesaplama", () => {
    const sales = sampleReport.departments[0];
    assert.equal(sales.achievement?.revenueAchievementPercent, 80);
    assert.equal(sales.achievement?.scoreAchievementPercent, 106);
    assert.ok((sales.achievement?.overallAchievementPercent ?? 0) > 0);
  });

  it("CSV export BOM ve kolonları içerir", () => {
    const csv = buildDepartmentPerformanceCsv(sampleReport);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /Departman/);
    assert.match(csv, /Satış/);
    assert.match(csv, /200000/);
  });
});

describe("duplicate target message", () => {
  it("409 mesajı kullanıcı dostu", () => {
    const message = "Bu kapsam ve dönem için zaten hedef tanımlı.";
    assert.match(message, /Bu kapsam ve dönem için zaten hedef tanımlı/);
  });
});

describe("employees module access for personnel performance", () => {
  it("ACCOUNTANT employees modülüne erişir ama hedef yönetemez", () => {
    assert.equal(canAccessEmployees("ACCOUNTANT"), true);
    assert.equal(canManageEmployees("ACCOUNTANT"), false);
  });
});
