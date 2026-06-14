import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { getPersonnelPerformanceReport } from "@/lib/employee-performance-service";
import { listEffectiveTargetsForPeriod } from "@/lib/employee-performance-target-service";
import {
  calculateTargetAchievement,
  pickEffectiveDepartmentTarget,
} from "@/lib/employee-performance-target-utils";
import { normalizePerformanceDateRange } from "@/lib/employee-performance-utils";
import { listEmployeeDepartments } from "@/lib/employee-department-service";

export type DepartmentPerformanceRow = {
  department: string;
  departmentId: string | null;
  departmentColor: string | null;
  isLegacyDepartment: boolean;
  employeeCount: number;
  totalRevenue: number;
  totalSales: number;
  totalCollection: number;
  totalPayrollCost: number;
  revenuePerEmployee: number;
  averageScore: number;
  leaveDays: number;
  efficiencyRatio: number | null;
  target: {
    revenueTarget: number | null;
    salesCountTarget: number | null;
    collectionTarget: number | null;
    scoreTarget: number | null;
  } | null;
  achievement: ReturnType<typeof calculateTargetAchievement>;
};

export type DepartmentPerformanceReport = {
  period: { from: string; to: string };
  summary: {
    departmentCount: number;
    topRevenueDepartment: string | null;
    topScoreDepartment: string | null;
    topEfficiencyDepartment: string | null;
    mostLeaveDepartment: string | null;
  };
  departments: DepartmentPerformanceRow[];
};

function aggregateDepartmentRows(
  department: string,
  meta: {
    departmentId: string | null;
    departmentColor: string | null;
    isLegacyDepartment: boolean;
  },
  employees: Awaited<
    ReturnType<typeof getPersonnelPerformanceReport>
  >["employees"]
) {
  const employeeCount = employees.length;
  const totalRevenue = roundCashMoney(
    employees.reduce((sum, row) => sum + row.revenue, 0)
  );
  const totalSales = employees.reduce((sum, row) => sum + row.salesCount, 0);
  const totalCollection = roundCashMoney(
    employees.reduce((sum, row) => sum + row.collectionTotal, 0)
  );
  const totalPayrollCost = roundCashMoney(
    employees.reduce((sum, row) => sum + row.payrollCost, 0)
  );
  const leaveDays = employees.reduce((sum, row) => sum + row.leaveDays, 0);
  const averageScore =
    employeeCount > 0
      ? Math.round(
          employees.reduce((sum, row) => sum + row.performanceScore, 0) /
            employeeCount
        )
      : 0;

  return {
    department,
    departmentId: meta.departmentId,
    departmentColor: meta.departmentColor,
    isLegacyDepartment: meta.isLegacyDepartment,
    employeeCount,
    totalRevenue,
    totalSales,
    totalCollection,
    totalPayrollCost,
    revenuePerEmployee:
      employeeCount > 0 ? roundCashMoney(totalRevenue / employeeCount) : 0,
    averageScore,
    leaveDays,
    efficiencyRatio:
      totalPayrollCost > 0 ? roundCashMoney(totalRevenue / totalPayrollCost) : null,
  };
}

export async function getDepartmentPerformanceReport(input: {
  companyId: string;
  from?: Date | string | null;
  to?: Date | string | null;
}): Promise<DepartmentPerformanceReport> {
  const rangeResult = normalizePerformanceDateRange({
    from: input.from,
    to: input.to,
  });

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const { from, to } = rangeResult;

  const [personnelReport, periodTargets, departmentRecords] = await Promise.all([
    getPersonnelPerformanceReport({
      companyId: input.companyId,
      from,
      to,
    }),
    listEffectiveTargetsForPeriod({
      companyId: input.companyId,
      periodStart: from,
      periodEnd: to,
    }),
    listEmployeeDepartments({
      companyId: input.companyId,
      includeInactive: true,
      syncLegacy: true,
    }),
  ]);

  const departmentByName = new Map(
    departmentRecords.map((row) => [row.name.toLowerCase(), row])
  );

  const grouped = new Map<
    string,
    {
      meta: {
        departmentId: string | null;
        departmentColor: string | null;
        isLegacyDepartment: boolean;
      };
      employees: typeof personnelReport.employees;
    }
  >();

  for (const employee of personnelReport.employees) {
    const department =
      employee.department?.trim() || "Belirtilmemiş";
    const record = departmentByName.get(department.toLowerCase());
    const bucket = grouped.get(department) ?? {
      meta: {
        departmentId: record?.id ?? null,
        departmentColor: record?.color ?? null,
        isLegacyDepartment: !record && department !== "Belirtilmemiş",
      },
      employees: [],
    };
    bucket.employees.push(employee);
    grouped.set(department, bucket);
  }

  const departments = [...grouped.entries()]
    .map(([department, bucket]) => {
      const aggregate = aggregateDepartmentRows(
        department,
        bucket.meta,
        bucket.employees
      );
      const effectiveTarget = pickEffectiveDepartmentTarget(
        periodTargets,
        department === "Belirtilmemiş" ? "" : department
      );

      const achievement = calculateTargetAchievement(
        {
          revenue: aggregate.totalRevenue,
          salesCount: aggregate.totalSales,
          collectionTotal: aggregate.totalCollection,
          performanceScore: aggregate.averageScore,
          leaveDays: aggregate.leaveDays,
          revenuePerPayrollCost: aggregate.efficiencyRatio,
        },
        effectiveTarget
      );

      return {
        ...aggregate,
        target: effectiveTarget
          ? {
              revenueTarget: effectiveTarget.revenueTarget,
              salesCountTarget: effectiveTarget.salesCountTarget,
              collectionTarget: effectiveTarget.collectionTarget,
              scoreTarget: effectiveTarget.scoreTarget,
            }
          : null,
        achievement,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const topRevenue = departments[0] ?? null;
  const topScore = [...departments].sort(
    (a, b) => b.averageScore - a.averageScore
  )[0];
  const topEfficiency = [...departments]
    .filter((row) => row.efficiencyRatio != null)
    .sort((a, b) => (b.efficiencyRatio ?? 0) - (a.efficiencyRatio ?? 0))[0];
  const mostLeave = [...departments].sort(
    (a, b) => b.leaveDays - a.leaveDays
  )[0];

  return {
    period: personnelReport.period,
    summary: {
      departmentCount: departments.length,
      topRevenueDepartment: topRevenue?.department ?? null,
      topScoreDepartment: topScore?.department ?? null,
      topEfficiencyDepartment: topEfficiency?.department ?? null,
      mostLeaveDepartment: mostLeave?.department ?? null,
    },
    departments,
  };
}

export function buildDepartmentPerformanceCsv(report: DepartmentPerformanceReport) {
  const header = [
    "Departman",
    "Çalışan",
    "Satış",
    "Ciro",
    "Tahsilat",
    "Maliyet",
    "Ciro/Çalışan",
    "Ort. Skor",
    "İzin Günü",
    "Hedef Ciro",
    "Hedef Satış",
    "Başarı %",
  ];

  const rows = report.departments.map((row) =>
    [
      row.department,
      String(row.employeeCount),
      String(row.totalSales),
      String(row.totalRevenue),
      String(row.totalCollection),
      String(row.totalPayrollCost),
      String(row.revenuePerEmployee),
      String(row.averageScore),
      String(row.leaveDays),
      row.target?.revenueTarget != null ? String(row.target.revenueTarget) : "",
      row.target?.salesCountTarget != null
        ? String(row.target.salesCountTarget)
        : "",
      row.achievement?.overallAchievementPercent != null
        ? String(row.achievement.overallAchievementPercent)
        : "",
    ]
      .map((cell) => {
        if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
        return cell;
      })
      .join(",")
  );

  return `\uFEFF${[header.join(","), ...rows].join("\n")}`;
}
