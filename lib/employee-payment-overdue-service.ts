import type { EmployeePaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export function startOfCalendarDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shouldMarkEmployeePaymentOverdue(input: {
  status: EmployeePaymentStatus;
  dueDate: Date | null;
  referenceDate?: Date;
}) {
  if (input.status !== "PENDING" || !input.dueDate) {
    return false;
  }

  return (
    startOfCalendarDay(input.dueDate) <
    startOfCalendarDay(input.referenceDate ?? new Date())
  );
}

export type OverdueEmployeePaymentsResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

export async function updateOverdueEmployeePaymentsForActiveCompanies(
  referenceDate: Date = new Date(),
  client: Pick<typeof db, "employeePayment"> = db
): Promise<OverdueEmployeePaymentsResult> {
  const todayStart = startOfCalendarDay(referenceDate);

  const where: Prisma.EmployeePaymentWhereInput = {
    status: "PENDING",
    dueDate: { lt: todayStart },
    company: { status: "ACTIVE" },
  };

  const scanned = await client.employeePayment.count({ where });

  const result = await client.employeePayment.updateMany({
    where,
    data: { status: "OVERDUE" },
  });

  return {
    scanned,
    updated: result.count,
    skipped: scanned - result.count,
  };
}

export function attachEmployeePaymentsOverdueSummary<
  T extends { success: true },
>(summary: T, overdueResult: OverdueEmployeePaymentsResult) {
  return {
    ...summary,
    employeePayments: {
      overdueUpdated: overdueResult.updated,
    },
  };
}
