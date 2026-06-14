import type { PersonnelPerformanceReport } from "@/lib/employee-performance-service";
import { buildPersonnelPerformanceCsvRow } from "@/lib/employee-performance-utils";

export function buildPersonnelPerformanceCsv(report: PersonnelPerformanceReport) {
  const header = [
    "Çalışan",
    "Departman",
    "Görev",
    "Satış Adedi",
    "Ciro",
    "Tahsilat",
    "Fatura",
    "Gider",
    "Personel Maliyeti",
    "Bekleyen Maliyet",
    "İzin Günü",
    "Performans Skoru",
    "Hedef Ciro",
    "Hedef Satış",
    "Hedef Skor",
    "Genel Başarı %",
  ];

  const rows = report.employees.map((employee) =>
    buildPersonnelPerformanceCsvRow([
      employee.employeeName,
      employee.department ?? "",
      employee.jobTitle ?? "",
      String(employee.salesCount),
      String(employee.revenue),
      String(employee.collectionTotal),
      String(employee.invoiceCount),
      String(employee.expenseCount),
      String(employee.payrollCost),
      String(employee.pendingPayrollCost),
      String(employee.leaveDays),
      String(employee.performanceScore),
      employee.target?.revenueTarget != null
        ? String(employee.target.revenueTarget)
        : "",
      employee.target?.salesCountTarget != null
        ? String(employee.target.salesCountTarget)
        : "",
      employee.target?.scoreTarget != null ? String(employee.target.scoreTarget) : "",
      employee.achievement?.overallAchievementPercent != null
        ? String(employee.achievement.overallAchievementPercent)
        : "",
    ])
  );

  return `\uFEFF${[buildPersonnelPerformanceCsvRow(header), ...rows].join("\n")}`;
}

export function buildPersonnelPerformanceExportFilename(from: string, to: string) {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  return `personel-performans-${start}-${end}.csv`;
}

export type { PersonnelPerformanceReport };
