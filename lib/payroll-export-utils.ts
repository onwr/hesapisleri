import {
  formatPayrollPeriodLabel,
  PAYROLL_ITEM_STATUS_LABELS,
  PAYROLL_RUN_STATUS_LABELS,
} from "@/lib/payroll-utils";
import type { SerializedPayrollRun } from "@/lib/payroll-service";
import { formatEmployeeDate } from "@/lib/employee-page-utils";

export function escapePayrollCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildPayrollExportFilename(
  periodStart: Date,
  periodEnd: Date,
  format: "csv" | "xlsx" = "csv"
) {
  const start = periodStart.toISOString().slice(0, 10);
  const end = periodEnd.toISOString().slice(0, 10);
  const ext = format === "xlsx" ? "csv" : "csv";
  return `bordro-${start}-${end}.${ext}`;
}

export function buildPayrollCsvContent(
  run: SerializedPayrollRun,
  companyName: string
) {
  const header = [
    "Firma",
    "Bordro",
    "Dönem",
    "Çalışan",
    "Departman",
    "Görev",
    "Baz Maaş",
    "Prim",
    "Kesinti",
    "Avans",
    "Net Ödenecek",
    "Durum",
    "Not",
  ];

  const periodLabel = formatPayrollPeriodLabel(
    new Date(run.periodStart),
    new Date(run.periodEnd)
  );

  const rows = run.items.map((item) => [
    companyName,
    run.title,
    periodLabel,
    item.employeeName,
    item.department ?? "",
    item.jobTitle ?? "",
    String(item.baseSalary),
    String(item.bonusAmount),
    String(item.deductionAmount),
    String(item.advanceDeduction),
    String(item.netPayable),
    item.statusLabel,
    item.notes ?? "",
  ]);

  return [header, ...rows]
    .map((line) => line.map((cell) => escapePayrollCsvValue(cell)).join(","))
    .join("\n");
}

export function buildPayrollCsvWithBom(
  run: SerializedPayrollRun,
  companyName: string
) {
  return `\uFEFF${buildPayrollCsvContent(run, companyName)}`;
}

export function buildPayrollPrintSummary(run: SerializedPayrollRun) {
  return {
    title: run.title,
    periodLabel: formatPayrollPeriodLabel(
      new Date(run.periodStart),
      new Date(run.periodEnd)
    ),
    payDateLabel: run.payDate ? formatEmployeeDate(run.payDate) : "—",
    statusLabel:
      PAYROLL_RUN_STATUS_LABELS[
        run.status as keyof typeof PAYROLL_RUN_STATUS_LABELS
      ],
    grossTotal: run.grossTotal,
    bonusTotal: run.bonusTotal,
    deductionTotal: run.deductionTotal,
    netTotal: run.netTotal,
    employeeCount: run.employeeCount,
  };
}

export function getPayrollItemStatusExportLabel(status: string) {
  return (
    PAYROLL_ITEM_STATUS_LABELS[
      status as keyof typeof PAYROLL_ITEM_STATUS_LABELS
    ] ?? status
  );
}
