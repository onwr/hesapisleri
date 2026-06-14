import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  calculateEmployeeBalance,
  calculateLeaveDays,
  formatEmployeeDisplayName,
} from "@/lib/employee-utils";
import { resolveEmployeeDepartmentName } from "@/lib/employee-department-utils";
import {
  calculateAverageTicket,
  calculateLeaveDaysInPeriod,
  calculatePayrollCostInPeriod,
  calculatePerformanceScore,
  calculatePercentChange,
  calculateRevenuePerPayrollCost,
  getPreviousPeriodRange,
  normalizePerformanceDateRange,
  type PerformanceBenchmarks,
} from "@/lib/employee-performance-utils";
import {
  buildPerformanceTrendPoints,
  calculateTargetAchievement,
  type TargetAchievement,
} from "@/lib/employee-performance-target-utils";
import {
  getEffectiveTargetForEmployee,
  listEffectiveTargetsForPeriod,
} from "@/lib/employee-performance-target-service";

type SalesAggregate = {
  salesCount: number;
  revenue: number;
  posSalesCount: number;
  manualSalesCount: number;
  collectionTotal: number;
};

function emptySalesAggregate(): SalesAggregate {
  return {
    salesCount: 0,
    revenue: 0,
    posSalesCount: 0,
    manualSalesCount: 0,
    collectionTotal: 0,
  };
}

function aggregateSalesRows(
  sales: Array<{
    total: Prisma.Decimal | number;
    paidAmount: Prisma.Decimal | number;
    sourceChannel: string;
  }>
): SalesAggregate {
  return sales.reduce((acc, sale) => {
    acc.salesCount += 1;
    acc.revenue += Number(sale.total);
    acc.collectionTotal += Number(sale.paidAmount);
    if (sale.sourceChannel === "POS") acc.posSalesCount += 1;
    if (sale.sourceChannel === "MANUAL") acc.manualSalesCount += 1;
    return acc;
  }, emptySalesAggregate());
}

async function fetchSalesMetricsForUser(input: {
  companyId: string;
  userId: string;
  from?: Date;
  to?: Date;
}) {
  const dateFilter =
    input.from && input.to
      ? { createdAt: { gte: input.from, lte: input.to } }
      : {};

  const where = {
    companyId: input.companyId,
    userId: input.userId,
    status: "COMPLETED" as const,
    ...dateFilter,
  };

  const [sales, invoiceCount, expenseCount] = await Promise.all([
    db.sale.findMany({
      where,
      select: {
        total: true,
        paidAmount: true,
        sourceChannel: true,
      },
    }),
    db.invoice.count({
      where: {
        companyId: input.companyId,
        sale: { userId: input.userId, ...dateFilter },
      },
    }),
    db.expense.count({
      where: {
        companyId: input.companyId,
        userId: input.userId,
        ...(input.from && input.to
          ? { date: { gte: input.from, lte: input.to } }
          : {}),
      },
    }),
  ]);

  const aggregate = aggregateSalesRows(sales);

  return {
    ...aggregate,
    revenue: roundCashMoney(aggregate.revenue),
    collectionTotal: roundCashMoney(aggregate.collectionTotal),
    invoiceCount,
    expenseCount,
    averageTicket: calculateAverageTicket(aggregate.revenue, aggregate.salesCount),
  };
}

function serializeManualRecord(record: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  salesCount: number;
  salesTotal: Prisma.Decimal;
  posSalesCount: number;
  manualSalesCount: number;
  invoiceCount: number;
  expenseCount: number;
  taskScore: Prisma.Decimal | null;
  note: string | null;
}) {
  return {
    id: record.id,
    periodStart: record.periodStart.toISOString(),
    periodEnd: record.periodEnd.toISOString(),
    salesCount: record.salesCount,
    salesTotal: Number(record.salesTotal),
    posSalesCount: record.posSalesCount,
    manualSalesCount: record.manualSalesCount,
    invoiceCount: record.invoiceCount,
    expenseCount: record.expenseCount,
    taskScore: record.taskScore ? Number(record.taskScore) : null,
    note: record.note,
  };
}

export type EmployeePerformanceDetail = Awaited<
  ReturnType<typeof getEmployeePerformanceDetail>
>;

export async function getEmployeePerformanceDetail(input: {
  companyId: string;
  employeeId: string;
  from?: Date | string | null;
  to?: Date | string | null;
}) {
  const rangeResult = normalizePerformanceDateRange({
    from: input.from,
    to: input.to,
  });

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const { from, to } = rangeResult;
  const previousRange = getPreviousPeriodRange({ from, to });

  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
    include: {
      companyUser: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      payments: true,
      leaveRequests: true,
    },
  });

  if (!employee) {
    throw new Error("Çalışan bulunamadı.");
  }

  const linkedUserId = employee.companyUser?.user.id ?? null;
  const employeeName = formatEmployeeDisplayName(employee);

  const [periodSales, previousSales, manualRecords, lastActivities] =
    await Promise.all([
      linkedUserId
        ? fetchSalesMetricsForUser({
            companyId: input.companyId,
            userId: linkedUserId,
            from,
            to,
          })
        : Promise.resolve({
            ...emptySalesAggregate(),
            invoiceCount: 0,
            expenseCount: 0,
            averageTicket: 0,
          }),
      linkedUserId
        ? fetchSalesMetricsForUser({
            companyId: input.companyId,
            userId: linkedUserId,
            from: previousRange.from,
            to: previousRange.to,
          })
        : Promise.resolve({
            ...emptySalesAggregate(),
            invoiceCount: 0,
            expenseCount: 0,
            averageTicket: 0,
          }),
      db.employeePerformanceRecord.findMany({
        where: { employeeId: input.employeeId, companyId: input.companyId },
        orderBy: { periodStart: "desc" },
        take: 12,
      }),
      db.activityLog.findMany({
        where: {
          companyId: input.companyId,
          module: "employees",
          message: { contains: employeeName },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const payroll = calculatePayrollCostInPeriod(employee.payments, from, to);
  const leaveDaysInPeriod = calculateLeaveDaysInPeriod(
    employee.leaveRequests,
    from,
    to
  );
  const leaveSummary = {
    pending: employee.leaveRequests.filter((l) => l.status === "PENDING").length,
    approved: employee.leaveRequests.filter((l) => l.status === "APPROVED")
      .length,
    totalDaysUsed: employee.leaveRequests
      .filter((l) => l.status === "APPROVED")
      .reduce(
        (sum, l) =>
          sum +
          (l.totalDays != null
            ? Number(l.totalDays)
            : calculateLeaveDays(l.startAt, l.endAt)),
        0
      ),
    leaveDaysInPeriod,
  };

  const paymentSummary = calculateEmployeeBalance(employee.payments);
  const revenuePerPayrollCost = calculateRevenuePerPayrollCost(
    periodSales.revenue,
    payroll.payrollCost
  );

  const performanceScore = calculatePerformanceScore({
    revenue: periodSales.revenue,
    salesCount: periodSales.salesCount,
    leaveDays: leaveDaysInPeriod,
    payrollCost: payroll.payrollCost,
    benchmarks: {
      maxRevenue: Math.max(periodSales.revenue, 1),
      maxSales: Math.max(periodSales.salesCount, 1),
      maxLeaveDays: Math.max(leaveDaysInPeriod, 22),
    },
  });

  const lastActivityAt = lastActivities[0]?.createdAt.toISOString() ?? null;

  const effectiveTarget = await getEffectiveTargetForEmployee({
    companyId: input.companyId,
    employeeId: input.employeeId,
    department: employee.department,
    periodStart: from,
    periodEnd: to,
  });

  const achievement = calculateTargetAchievement(
    {
      revenue: periodSales.revenue,
      salesCount: periodSales.salesCount,
      collectionTotal: periodSales.collectionTotal,
      performanceScore,
      leaveDays: leaveDaysInPeriod,
      revenuePerPayrollCost,
    },
    effectiveTarget
  );

  const serializedRecords = manualRecords.map(serializeManualRecord);
  const trend = buildPerformanceTrendPoints(serializedRecords);

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    totalSalesCount: periodSales.salesCount,
    totalSalesAmount: periodSales.revenue,
    thisMonthSalesCount: periodSales.salesCount,
    thisMonthSalesAmount: periodSales.revenue,
    posSalesCount: periodSales.posSalesCount,
    manualSalesCount: periodSales.manualSalesCount,
    invoiceCount: periodSales.invoiceCount,
    expenseCount: periodSales.expenseCount,
    averageTicket: periodSales.averageTicket,
    collectionTotal: periodSales.collectionTotal,
    payrollCost: payroll.payrollCost,
    pendingPayrollCost: payroll.pendingPayrollCost,
    revenuePerPayrollCost,
    leaveDaysInPeriod,
    performanceScore,
    hasLinkedUser: Boolean(linkedUserId),
    linkedUser: linkedUserId
      ? {
          id: linkedUserId,
          name: employee.companyUser?.user.name ?? "",
          email: employee.companyUser?.user.email ?? "",
        }
      : null,
    comparison: {
      revenueChangePercent: calculatePercentChange(
        periodSales.revenue,
        previousSales.revenue
      ),
      salesCountChangePercent: calculatePercentChange(
        periodSales.salesCount,
        previousSales.salesCount
      ),
      previousRevenue: previousSales.revenue,
      previousSalesCount: previousSales.salesCount,
    },
    manualRecords: serializedRecords,
    trend,
    target: effectiveTarget
      ? {
          revenueTarget: effectiveTarget.revenueTarget,
          salesCountTarget: effectiveTarget.salesCountTarget,
          collectionTarget: effectiveTarget.collectionTarget,
          scoreTarget: effectiveTarget.scoreTarget,
          maxLeaveDays: effectiveTarget.maxLeaveDays,
          scope: effectiveTarget.scope,
        }
      : null,
    achievement,
    paymentSummary,
    leaveSummary,
    lastActivities: lastActivities.map((a) => ({
      id: a.id,
      action: a.action,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
    lastActivityAt,
  };
}

export type PersonnelPerformanceEmployeeRow = {
  employeeId: string;
  employeeName: string;
  department: string | null;
  jobTitle: string | null;
  hasLinkedUser: boolean;
  salesCount: number;
  revenue: number;
  posSalesCount: number;
  manualSalesCount: number;
  expenseCount: number;
  invoiceCount: number;
  collectionTotal: number;
  payrollCost: number;
  pendingPayrollCost: number;
  leaveDays: number;
  performanceScore: number;
  target: {
    revenueTarget: number | null;
    salesCountTarget: number | null;
    collectionTarget: number | null;
    scoreTarget: number | null;
  } | null;
  achievement: TargetAchievement | null;
};

export type PersonnelPerformanceReport = {
  period: { from: string; to: string };
  summary: {
    employeeCount: number;
    totalSales: number;
    totalRevenue: number;
    totalPayrollCost: number;
    revenuePerEmployee: number;
    averageSalesPerEmployee: number;
  };
  employees: PersonnelPerformanceEmployeeRow[];
};

async function buildEmployeePerformanceRow(input: {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    department: string | null;
    departmentRef?: {
      id: string;
      name: string;
      color: string | null;
      isActive: boolean;
    } | null;
    jobTitle: string | null;
    companyUser: { user: { id: string } } | null;
    payments: Array<{
      amount: Prisma.Decimal;
      status: string;
      type: string;
      paidAt: Date | null;
      dueDate: Date | null;
    }>;
    leaveRequests: Array<{
      startAt: Date;
      endAt: Date;
      status: string;
    }>;
  };
  companyId: string;
  from: Date;
  to: Date;
  salesByUserId: Map<string, SalesAggregate & { invoiceCount: number; expenseCount: number }>;
  expenseCountByUserId: Map<string, number>;
  invoiceCountByUserId: Map<string, number>;
}) {
  const linkedUserId = input.employee.companyUser?.user.id ?? null;
  const sales = linkedUserId
    ? input.salesByUserId.get(linkedUserId) ?? emptySalesAggregate()
    : emptySalesAggregate();
  const invoiceCount = linkedUserId
    ? input.invoiceCountByUserId.get(linkedUserId) ?? 0
    : 0;
  const expenseCount = linkedUserId
    ? input.expenseCountByUserId.get(linkedUserId) ?? 0
    : 0;

  const payroll = calculatePayrollCostInPeriod(input.employee.payments, input.from, input.to);
  const leaveDays = calculateLeaveDaysInPeriod(
    input.employee.leaveRequests,
    input.from,
    input.to
  );

  return {
    employeeId: input.employee.id,
    employeeName: formatEmployeeDisplayName(input.employee),
    department: resolveEmployeeDepartmentName({
      department: input.employee.department,
      departmentRef: input.employee.departmentRef,
    }),
    jobTitle: input.employee.jobTitle,
    hasLinkedUser: Boolean(linkedUserId),
    salesCount: sales.salesCount,
    revenue: roundCashMoney(sales.revenue),
    posSalesCount: sales.posSalesCount,
    manualSalesCount: sales.manualSalesCount,
    expenseCount,
    invoiceCount,
    collectionTotal: roundCashMoney(sales.collectionTotal),
    payrollCost: payroll.payrollCost,
    pendingPayrollCost: payroll.pendingPayrollCost,
    leaveDays,
    performanceScore: 0,
  };
}

export async function getPersonnelPerformanceReport(input: {
  companyId: string;
  from?: Date | string | null;
  to?: Date | string | null;
  department?: string;
  employeeId?: string;
}): Promise<PersonnelPerformanceReport> {
  const rangeResult = normalizePerformanceDateRange({
    from: input.from,
    to: input.to,
  });

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const { from, to } = rangeResult;

  const employees = await db.employee.findMany({
    where: {
      companyId: input.companyId,
      status: { in: ["ACTIVE", "ON_LEAVE"] },
      ...(input.employeeId ? { id: input.employeeId } : {}),
      ...(input.department ? { department: input.department } : {}),
    },
    include: {
      departmentRef: {
        select: { id: true, name: true, color: true, isActive: true },
      },
      companyUser: {
        include: { user: { select: { id: true } } },
      },
      payments: true,
      leaveRequests: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const userIds = employees
    .map((employee) => employee.companyUser?.user.id)
    .filter((id): id is string => Boolean(id));

  const [sales, expenses, invoices] = await Promise.all([
    userIds.length
      ? db.sale.findMany({
          where: {
            companyId: input.companyId,
            userId: { in: userIds },
            status: "COMPLETED",
            createdAt: { gte: from, lte: to },
          },
          select: {
            userId: true,
            total: true,
            paidAmount: true,
            sourceChannel: true,
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? db.expense.findMany({
          where: {
            companyId: input.companyId,
            userId: { in: userIds },
            date: { gte: from, lte: to },
          },
          select: { userId: true },
        })
      : Promise.resolve([]),
    userIds.length
      ? db.invoice.findMany({
          where: {
            companyId: input.companyId,
            sale: {
              userId: { in: userIds },
              createdAt: { gte: from, lte: to },
            },
          },
          select: { sale: { select: { userId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const salesByUserId = new Map<
    string,
    SalesAggregate & { invoiceCount: number; expenseCount: number }
  >();
  for (const sale of sales) {
    if (!sale.userId) continue;
    const current =
      salesByUserId.get(sale.userId) ??
      ({ ...emptySalesAggregate(), invoiceCount: 0, expenseCount: 0 });
    current.salesCount += 1;
    current.revenue += Number(sale.total);
    current.collectionTotal += Number(sale.paidAmount);
    if (sale.sourceChannel === "POS") current.posSalesCount += 1;
    if (sale.sourceChannel === "MANUAL") current.manualSalesCount += 1;
    salesByUserId.set(sale.userId, current);
  }

  const expenseCountByUserId = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.userId) continue;
    expenseCountByUserId.set(
      expense.userId,
      (expenseCountByUserId.get(expense.userId) ?? 0) + 1
    );
  }

  const invoiceCountByUserId = new Map<string, number>();
  for (const invoice of invoices) {
    const userId = invoice.sale?.userId;
    if (!userId) continue;
    invoiceCountByUserId.set(userId, (invoiceCountByUserId.get(userId) ?? 0) + 1);
  }

  const rows = await Promise.all(
    employees.map((employee) =>
      buildEmployeePerformanceRow({
        employee,
        companyId: input.companyId,
        from,
        to,
        salesByUserId,
        expenseCountByUserId,
        invoiceCountByUserId,
      })
    )
  );

  const benchmarks: PerformanceBenchmarks = {
    maxRevenue: Math.max(...rows.map((row) => row.revenue), 1),
    maxSales: Math.max(...rows.map((row) => row.salesCount), 1),
    maxLeaveDays: Math.max(...rows.map((row) => row.leaveDays), 22),
  };

  const employeesWithScore = rows.map((row) => ({
    ...row,
    performanceScore: calculatePerformanceScore({
      revenue: row.revenue,
      salesCount: row.salesCount,
      leaveDays: row.leaveDays,
      payrollCost: row.payrollCost,
      benchmarks,
    }),
  }));

  const periodTargets = await listEffectiveTargetsForPeriod({
    companyId: input.companyId,
    periodStart: from,
    periodEnd: to,
  });

  const employeesWithTargets = employeesWithScore.map((row) => {
    const effectiveTarget =
      periodTargets.find(
        (target) =>
          target.scope === "employee" && target.employeeId === row.employeeId
      ) ??
      (row.department
        ? periodTargets.find(
            (target) =>
              target.scope === "department" && target.department === row.department
          )
        : null) ??
      periodTargets.find((target) => target.scope === "company") ??
      null;

    const achievement = calculateTargetAchievement(
      {
        revenue: row.revenue,
        salesCount: row.salesCount,
        collectionTotal: row.collectionTotal,
        performanceScore: row.performanceScore,
        leaveDays: row.leaveDays,
        revenuePerPayrollCost:
          row.payrollCost > 0 ? row.revenue / row.payrollCost : null,
      },
      effectiveTarget
    );

    return {
      ...row,
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
  });

  const totalSales = employeesWithTargets.reduce((sum, row) => sum + row.salesCount, 0);
  const totalRevenue = roundCashMoney(
    employeesWithTargets.reduce((sum, row) => sum + row.revenue, 0)
  );
  const totalPayrollCost = roundCashMoney(
    employeesWithTargets.reduce((sum, row) => sum + row.payrollCost, 0)
  );
  const employeeCount = employeesWithTargets.length;

  return {
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    summary: {
      employeeCount,
      totalSales,
      totalRevenue,
      totalPayrollCost,
      revenuePerEmployee:
        employeeCount > 0 ? roundCashMoney(totalRevenue / employeeCount) : 0,
      averageSalesPerEmployee:
        employeeCount > 0 ? roundCashMoney(totalSales / employeeCount) : 0,
    },
    employees: employeesWithTargets,
  };
}

export async function createEmployeePerformanceSnapshotForEmployee(input: {
  companyId: string;
  employeeId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  const rangeResult = normalizePerformanceDateRange({
    from: input.periodStart,
    to: input.periodEnd,
  });

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const employee = await db.employee.findFirst({
    where: {
      id: input.employeeId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
  });

  if (!employee) {
    return {
      status: "skipped" as const,
      reason: "inactive_or_missing",
    };
  }

  const existing = await db.employeePerformanceRecord.findFirst({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      periodStart: rangeResult.from,
      periodEnd: rangeResult.to,
    },
  });

  if (existing) {
    return {
      status: "skipped" as const,
      reason: "duplicate",
      record: serializeManualRecord(existing),
    };
  }

  const report = await getPersonnelPerformanceReport({
    companyId: input.companyId,
    from: rangeResult.from,
    to: rangeResult.to,
    employeeId: input.employeeId,
  });

  const row = report.employees[0];
  if (!row) {
    return {
      status: "skipped" as const,
      reason: "no_metrics",
    };
  }

  const record = await db.employeePerformanceRecord.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      periodStart: rangeResult.from,
      periodEnd: rangeResult.to,
      salesCount: row.salesCount,
      salesTotal: row.revenue,
      posSalesCount: row.posSalesCount,
      manualSalesCount: row.manualSalesCount,
      invoiceCount: row.invoiceCount,
      expenseCount: row.expenseCount,
      taskScore: row.performanceScore,
      metadata: {
        payrollCost: row.payrollCost,
        leaveDays: row.leaveDays,
        collectionTotal: row.collectionTotal,
      },
    },
  });

  return {
    status: "created" as const,
    record: serializeManualRecord(record),
  };
}

export async function createEmployeePerformanceSnapshot(input: {
  companyId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  employeeId?: string;
}) {
  const rangeResult = normalizePerformanceDateRange({
    from: input.periodStart,
    to: input.periodEnd,
  });

  if (!rangeResult.ok) {
    throw new Error(rangeResult.message);
  }

  const employees = await db.employee.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
      ...(input.employeeId ? { id: input.employeeId } : {}),
    },
    select: { id: true },
  });

  const records = [];
  let createdCount = 0;
  let skippedCount = 0;

  for (const employee of employees) {
    const result = await createEmployeePerformanceSnapshotForEmployee({
      companyId: input.companyId,
      employeeId: employee.id,
      periodStart: rangeResult.from,
      periodEnd: rangeResult.to,
    });

    if (result.status === "created" && result.record) {
      createdCount += 1;
      records.push(result.record);
    } else {
      skippedCount += 1;
    }
  }

  return {
    createdCount,
    skippedCount,
    records,
  };
}
