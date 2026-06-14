import { endOfDay, startOfDay } from "@/lib/calendar-utils";

export function isEmployeePerformanceCronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export function getDefaultSnapshotPeriod(reference = new Date()) {
  const year =
    reference.getMonth() === 0
      ? reference.getFullYear() - 1
      : reference.getFullYear();
  const month = reference.getMonth() === 0 ? 11 : reference.getMonth() - 1;

  const from = startOfDay(new Date(year, month, 1));
  const to = endOfDay(new Date(year, month + 1, 0));

  return { from, to };
}

export function buildSnapshotDuplicateKey(input: {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return `${input.employeeId}:${input.periodStart.toISOString()}:${input.periodEnd.toISOString()}`;
}

export function shouldSkipInactiveEmployee(status: string) {
  return status !== "ACTIVE";
}

export type EmployeePerformanceCronItem = {
  companyId: string;
  companyName: string;
  employeeId: string;
  employeeName: string;
  status: "created" | "skipped";
  reason?: string;
};

export type EmployeePerformanceCronSummary = {
  success: true;
  companiesScanned: number;
  created: number;
  skipped: number;
  period: { from: string; to: string };
  items: EmployeePerformanceCronItem[];
};
