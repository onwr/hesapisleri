import { db } from "@/lib/prisma";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import { createEmployeePerformanceSnapshotForEmployee } from "@/lib/employee-performance-service";
import {
  getDefaultSnapshotPeriod,
  type EmployeePerformanceCronSummary,
} from "@/lib/employee-performance-cron-utils";

export async function runEmployeePerformanceSnapshotCron(input?: {
  periodStart?: Date | string;
  periodEnd?: Date | string;
}): Promise<EmployeePerformanceCronSummary> {
  const period =
    input?.periodStart && input?.periodEnd
      ? {
          from: new Date(input.periodStart),
          to: new Date(input.periodEnd),
        }
      : getDefaultSnapshotPeriod();

  const companies = await db.company.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let created = 0;
  let skipped = 0;
  const items: EmployeePerformanceCronSummary["items"] = [];

  for (const company of companies) {
    const employees = await db.employee.findMany({
      where: { companyId: company.id, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, status: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    for (const employee of employees) {
      const result = await createEmployeePerformanceSnapshotForEmployee({
        companyId: company.id,
        employeeId: employee.id,
        periodStart: period.from,
        periodEnd: period.to,
      });

      if (result.status === "created") {
        created += 1;
      } else {
        skipped += 1;
      }

      items.push({
        companyId: company.id,
        companyName: company.name,
        employeeId: employee.id,
        employeeName: formatEmployeeDisplayName(employee),
        status: result.status,
        reason: result.reason,
      });
    }
  }

  return {
    success: true,
    companiesScanned: companies.length,
    created,
    skipped,
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    items,
  };
}
