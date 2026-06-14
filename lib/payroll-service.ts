import type { PayrollRunStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  createEmployeePayment,
  markEmployeePaymentPaid,
} from "@/lib/employee-service";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import { createNotification } from "@/lib/notification-service";
import {
  buildDefaultPayrollTitle,
  buildPayrollPaymentDescription,
  buildPayrollRunActionUrl,
  buildPayrollItemUpdatePayload,
  calculatePayrollItemNetPayable,
  calculatePayrollRunTotals,
  canApprovePayrollRun,
  canCancelPayrollRun,
  canEditPayrollRunItems,
  canGeneratePayrollPayments,
  canMarkPayrollRunPaid,
  canRecalculatePayrollRun,
  isDuplicatePayrollPeriodConflict,
  isPaymentInPayrollPeriod,
  normalizePayrollPeriod,
  PAYROLL_ITEM_STATUS_LABELS,
  PAYROLL_RUN_STATUS_LABELS,
  sumPaymentsByType,
  validatePayrollItemNetPayable,
  validatePayrollItemUpdateInput,
} from "@/lib/payroll-utils";
import {
  getPaymentStatusLabel,
  getPaymentTypeLabel,
} from "@/lib/employee-utils";

export class PayrollServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PayrollServiceError";
    this.status = status;
  }
}

type DbClient = Prisma.TransactionClient | typeof db;

const payrollRunInclude = {
  items: {
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          jobTitle: true,
          department: true,
        },
      },
      employeePayment: {
        select: {
          id: true,
          status: true,
          amount: true,
          dueDate: true,
          paidAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PayrollRunInclude;

async function logPayrollActivity(
  client: DbClient,
  input: {
    companyId: string;
    userId: string;
    action: string;
    message: string;
  }
) {
  await client.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      module: "employees",
      message: input.message,
    },
  });
}

async function getPayrollRunInCompany(payrollRunId: string, companyId: string) {
  const run = await db.payrollRun.findFirst({
    where: { id: payrollRunId, companyId },
    include: payrollRunInclude,
  });

  if (!run) {
    throw new PayrollServiceError("Bordro kaydı bulunamadı.", 404);
  }

  return run;
}

function serializePayrollItem(
  item: Prisma.PayrollRunItemGetPayload<{
    include: {
      employee: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          status: true;
          jobTitle: true;
          department: true;
        };
      };
      employeePayment: {
        select: {
          id: true;
          status: true;
          amount: true;
          dueDate: true;
          paidAt: true;
        };
      };
    };
  }>
) {
  return {
    id: item.id,
    employeeId: item.employeeId,
    employeeName: formatEmployeeDisplayName(item.employee),
    employeeStatus: item.employee.status,
    jobTitle: item.employee.jobTitle,
    department: item.employee.department,
    salaryId: item.salaryId,
    baseSalary: Number(item.baseSalary),
    bonusAmount: Number(item.bonusAmount),
    deductionAmount: Number(item.deductionAmount),
    advanceDeduction: Number(item.advanceDeduction),
    netPayable: Number(item.netPayable),
    currency: item.currency,
    status: item.status,
    statusLabel: PAYROLL_ITEM_STATUS_LABELS[item.status],
    employeePaymentId: item.employeePaymentId,
    employeePayment: item.employeePayment
      ? {
          id: item.employeePayment.id,
          status: item.employeePayment.status,
          amount: Number(item.employeePayment.amount),
          dueDate: item.employeePayment.dueDate?.toISOString() ?? null,
          paidAt: item.employeePayment.paidAt?.toISOString() ?? null,
        }
      : null,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function serializePayrollRun(
  run: Prisma.PayrollRunGetPayload<{ include: typeof payrollRunInclude }>
) {
  const items = run.items.map(serializePayrollItem);

  return {
    id: run.id,
    title: run.title,
    periodStart: run.periodStart.toISOString(),
    periodEnd: run.periodEnd.toISOString(),
    payDate: run.payDate?.toISOString() ?? null,
    status: run.status,
    statusLabel: PAYROLL_RUN_STATUS_LABELS[run.status],
    currency: run.currency,
    grossTotal: Number(run.grossTotal),
    deductionTotal: Number(run.deductionTotal),
    bonusTotal: Number(run.bonusTotal),
    netTotal: Number(run.netTotal),
    employeeCount: items.length,
    approvedAt: run.approvedAt?.toISOString() ?? null,
    paidAt: run.paidAt?.toISOString() ?? null,
    notes: run.notes,
    items,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

async function assertNoDuplicatePayrollPeriod(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
  excludeId?: string
) {
  const existing = await db.payrollRun.findFirst({
    where: {
      companyId,
      periodStart,
      periodEnd,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, status: true },
  });

  if (existing && isDuplicatePayrollPeriodConflict(existing)) {
    throw new PayrollServiceError(
      "Bu dönem için zaten bir bordro kaydı var.",
      409
    );
  }
}

async function buildPayrollItemsForPeriod(input: {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const employees = await db.employee.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
    },
    include: {
      salaryRecords: {
        where: { isActive: true },
        take: 1,
      },
      payments: {
        where: {
          status: { in: ["PENDING", "OVERDUE"] },
          type: { in: ["BONUS", "DEDUCTION", "ADVANCE"] },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const included: Array<{
    employeeId: string;
    salaryId: string;
    baseSalary: number;
    bonusAmount: number;
    deductionAmount: number;
    advanceDeduction: number;
    netPayable: number;
  }> = [];

  const warnings: Array<{ employeeId: string; employeeName: string; reason: string }> =
    [];

  for (const employee of employees) {
    const activeSalary = employee.salaryRecords[0];

    if (!activeSalary) {
      warnings.push({
        employeeId: employee.id,
        employeeName: formatEmployeeDisplayName(employee),
        reason: "Aktif maaş kaydı yok",
      });
      continue;
    }

    const bonusAmount = sumPaymentsByType(
      employee.payments,
      "BONUS",
      input.periodStart,
      input.periodEnd
    );
    const deductionAmount = sumPaymentsByType(
      employee.payments,
      "DEDUCTION",
      input.periodStart,
      input.periodEnd
    );
    const advanceDeduction = sumPaymentsByType(
      employee.payments,
      "ADVANCE",
      input.periodStart,
      input.periodEnd
    );
    const baseSalary = Number(activeSalary.amount);
    const netPayable = calculatePayrollItemNetPayable({
      baseSalary,
      bonusAmount,
      deductionAmount,
      advanceDeduction,
    });

    if (netPayable <= 0) {
      warnings.push({
        employeeId: employee.id,
        employeeName: formatEmployeeDisplayName(employee),
        reason: "Net ödenecek tutar sıfır veya negatif",
      });
      continue;
    }

    included.push({
      employeeId: employee.id,
      salaryId: activeSalary.id,
      baseSalary,
      bonusAmount,
      deductionAmount,
      advanceDeduction,
      netPayable,
    });
  }

  return { included, warnings };
}

export async function previewPayrollRun(input: {
  companyId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  const period = normalizePayrollPeriod(input);
  if (!period.ok) {
    throw new PayrollServiceError(period.message);
  }

  await assertNoDuplicatePayrollPeriod(
    input.companyId,
    period.periodStart,
    period.periodEnd
  );

  const { included, warnings } = await buildPayrollItemsForPeriod({
    companyId: input.companyId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  const totals = calculatePayrollRunTotals(included);

  return {
    employeeCount: totals.employeeCount,
    grossTotal: totals.grossTotal,
    bonusTotal: totals.bonusTotal,
    deductionTotal: totals.deductionTotal,
    netTotal: totals.netTotal,
    warnings,
  };
}

export async function createPayrollRun(input: {
  companyId: string;
  actorUserId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  payDate?: Date | string | null;
  title?: string;
  notes?: string;
}) {
  const period = normalizePayrollPeriod(input);
  if (!period.ok) {
    throw new PayrollServiceError(period.message);
  }

  await assertNoDuplicatePayrollPeriod(
    input.companyId,
    period.periodStart,
    period.periodEnd
  );

  const { included, warnings } = await buildPayrollItemsForPeriod({
    companyId: input.companyId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  if (included.length === 0) {
    throw new PayrollServiceError(
      "Bordroya dahil edilecek aktif maaşlı çalışan bulunamadı."
    );
  }

  const totals = calculatePayrollRunTotals(included);
  const payDate = input.payDate ? new Date(input.payDate) : null;
  const title =
    input.title?.trim() ||
    buildDefaultPayrollTitle(period.periodStart, period.periodEnd);

  const run = await db.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        companyId: input.companyId,
        title,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        payDate,
        status: "DRAFT",
        currency: "TRY",
        grossTotal: totals.grossTotal,
        bonusTotal: totals.bonusTotal,
        deductionTotal: totals.deductionTotal,
        netTotal: totals.netTotal,
        createdByUserId: input.actorUserId,
        notes: input.notes?.trim() || null,
        items: {
          create: included.map((item) => ({
            companyId: input.companyId,
            employeeId: item.employeeId,
            salaryId: item.salaryId,
            baseSalary: item.baseSalary,
            bonusAmount: item.bonusAmount,
            deductionAmount: item.deductionAmount,
            advanceDeduction: item.advanceDeduction,
            netPayable: item.netPayable,
            currency: "TRY",
            status: "DRAFT",
          })),
        },
      },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_CREATE",
      message: `${title} bordrosu oluşturuldu (${included.length} çalışan).`,
    });

    return created;
  });

  await createNotification({
    companyId: input.companyId,
    category: "FINANCE",
    module: "employees",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    actionUrl: buildPayrollRunActionUrl(run.id),
    title: "Bordro oluşturuldu",
    message: `${title} taslak olarak oluşturuldu.`,
  });

  return {
    payrollRun: serializePayrollRun(run),
    warnings,
  };
}

export async function recalculatePayrollRun(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canRecalculatePayrollRun(run.status)) {
    throw new PayrollServiceError("Yalnızca taslak bordrolar yeniden hesaplanabilir.");
  }

  const { included } = await buildPayrollItemsForPeriod({
    companyId: input.companyId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
  });

  if (included.length === 0) {
    throw new PayrollServiceError(
      "Yeniden hesaplama sonucu dahil edilecek çalışan kalmadı."
    );
  }

  const totals = calculatePayrollRunTotals(included);
  const includedEmployeeIds = new Set(included.map((item) => item.employeeId));

  const updated = await db.$transaction(async (tx) => {
    await tx.payrollRunItem.deleteMany({
      where: {
        payrollRunId: run.id,
        employeeId: { notIn: [...includedEmployeeIds] },
      },
    });

    for (const item of included) {
      const existing = run.items.find((row) => row.employeeId === item.employeeId);

      if (existing) {
        await tx.payrollRunItem.update({
          where: { id: existing.id },
          data: {
            salaryId: item.salaryId,
            baseSalary: item.baseSalary,
            bonusAmount: item.bonusAmount,
            deductionAmount: item.deductionAmount,
            advanceDeduction: item.advanceDeduction,
            netPayable: item.netPayable,
          },
        });
      } else {
        await tx.payrollRunItem.create({
          data: {
            companyId: input.companyId,
            payrollRunId: run.id,
            employeeId: item.employeeId,
            salaryId: item.salaryId,
            baseSalary: item.baseSalary,
            bonusAmount: item.bonusAmount,
            deductionAmount: item.deductionAmount,
            advanceDeduction: item.advanceDeduction,
            netPayable: item.netPayable,
            currency: "TRY",
            status: "DRAFT",
          },
        });
      }
    }

    const refreshed = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        grossTotal: totals.grossTotal,
        bonusTotal: totals.bonusTotal,
        deductionTotal: totals.deductionTotal,
        netTotal: totals.netTotal,
      },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_RECALC",
      message: `${run.title} bordrosu yeniden hesaplandı.`,
    });

    return refreshed;
  });

  return serializePayrollRun(updated);
}

export async function approvePayrollRun(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canApprovePayrollRun(run.status)) {
    throw new PayrollServiceError("Yalnızca taslak bordrolar onaylanabilir.");
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.payrollRunItem.updateMany({
      where: { payrollRunId: run.id },
      data: { status: "APPROVED" },
    });

    const result = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "APPROVED",
        approvedByUserId: input.actorUserId,
        approvedAt: new Date(),
      },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_APPROVE",
      message: `${run.title} bordrosu onaylandı.`,
    });

    return result;
  });

  await createNotification({
    companyId: input.companyId,
    category: "FINANCE",
    module: "employees",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    actionUrl: buildPayrollRunActionUrl(run.id),
    title: "Bordro onaylandı",
    message: `${run.title} onaylandı.`,
  });

  return serializePayrollRun(updated);
}

export async function generateEmployeePaymentsForPayrollRun(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canGeneratePayrollPayments(run.status)) {
    throw new PayrollServiceError(
      "Ödeme kayıtları yalnızca onaylanmış bordrolar için oluşturulabilir."
    );
  }

  const description = buildPayrollPaymentDescription(
    run.periodStart,
    run.periodEnd
  );
  const dueDate = run.payDate ?? run.periodEnd;
  let createdCount = 0;
  let skippedCount = 0;

  for (const item of run.items) {
    if (item.employeePaymentId) {
      skippedCount += 1;
      continue;
    }

    const payment = await createEmployeePayment({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: item.employeeId,
      type: "SALARY",
      direction: "PAYABLE",
      amount: Number(item.netPayable),
      currency: item.currency,
      dueDate,
      description,
    });

    await db.payrollRunItem.update({
      where: { id: item.id },
      data: { employeePaymentId: payment.id },
    });

    createdCount += 1;
  }

  const refreshed = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  await logPayrollActivity(db, {
    companyId: input.companyId,
    userId: input.actorUserId,
    action: "PAYROLL_GENERATE_PAYMENTS",
    message: `${run.title} için ${createdCount} ödeme kaydı oluşturuldu.`,
  });

  return {
    payrollRun: serializePayrollRun(refreshed),
    createdCount,
    skippedCount,
  };
}

export async function markPayrollRunPaid(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
  paidAt?: Date;
  relatedAccountId?: string | null;
  createExpense?: boolean;
  createTransaction?: boolean;
  notes?: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canMarkPayrollRunPaid(run.status)) {
    throw new PayrollServiceError(
      "Yalnızca onaylanmış bordrolar toplu ödendi işaretlenebilir."
    );
  }

  const itemsWithoutPayment = run.items.filter((item) => !item.employeePaymentId);
  if (itemsWithoutPayment.length > 0) {
    throw new PayrollServiceError(
      "Önce tüm kalemler için ödeme kayıtları oluşturulmalı."
    );
  }

  if (input.createTransaction && !input.relatedAccountId) {
    throw new PayrollServiceError(
      "Kasa/banka hareketi için hesap seçilmelidir."
    );
  }

  const paidAt = input.paidAt ?? new Date();
  let paidCount = 0;

  for (const item of run.items) {
    if (!item.employeePaymentId) continue;

    await markEmployeePaymentPaid({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: item.employeeId,
      paymentId: item.employeePaymentId,
      paidAt,
      relatedAccountId: input.relatedAccountId,
      createExpense: input.createExpense,
      createTransaction: input.createTransaction,
      notes: input.notes,
    });

    paidCount += 1;
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.payrollRunItem.updateMany({
      where: { payrollRunId: run.id },
      data: { status: "PAID" },
    });

    const result = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "PAID",
        paidAt,
      },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_PAID",
      message: `${run.title} bordrosu ödendi (${paidCount} çalışan).`,
    });

    return result;
  });

  await createNotification({
    companyId: input.companyId,
    category: "FINANCE",
    module: "employees",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    actionUrl: buildPayrollRunActionUrl(run.id),
    title: "Bordro ödendi",
    message: `${run.title} toplu ödeme tamamlandı.`,
  });

  return serializePayrollRun(updated);
}

export async function cancelPayrollRun(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canCancelPayrollRun(run.status)) {
    throw new PayrollServiceError("Bu bordro iptal edilemez.");
  }

  const paidPayment = run.items.find(
    (item) => item.employeePayment?.status === "PAID"
  );
  if (paidPayment) {
    throw new PayrollServiceError(
      "Ödenmiş kalemler bulunduğu için bordro iptal edilemez."
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const paymentIds = run.items
      .map((item) => item.employeePaymentId)
      .filter((id): id is string => Boolean(id));

    if (paymentIds.length > 0) {
      await tx.employeePayment.updateMany({
        where: {
          id: { in: paymentIds },
          companyId: input.companyId,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        data: { status: "CANCELLED" },
      });
    }

    await tx.payrollRunItem.updateMany({
      where: { payrollRunId: run.id },
      data: { status: "CANCELLED" },
    });

    const result = await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED" },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_CANCEL",
      message: `${run.title} bordrosu iptal edildi.`,
    });

    return result;
  });

  return serializePayrollRun(updated);
}

export async function getPayrollRunDetail(input: {
  companyId: string;
  payrollRunId: string;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);
  return serializePayrollRun(run);
}

export async function updatePayrollRunItem(input: {
  companyId: string;
  actorUserId: string;
  payrollRunId: string;
  itemId: string;
  bonusAmount?: number;
  deductionAmount?: number;
  advanceDeduction?: number;
  notes?: string | null;
}) {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);

  if (!canEditPayrollRunItems(run.status)) {
    throw new PayrollServiceError(
      "Yalnızca taslak bordro kalemleri düzenlenebilir.",
      400
    );
  }

  const item = run.items.find((row) => row.id === input.itemId);
  if (!item) {
    throw new PayrollServiceError("Bordro kalemi bulunamadı.", 404);
  }

  const validation = validatePayrollItemUpdateInput({
    bonusAmount: input.bonusAmount,
    deductionAmount: input.deductionAmount,
    advanceDeduction: input.advanceDeduction,
  });
  if (!validation.ok) {
    throw new PayrollServiceError(validation.message);
  }

  const payload = buildPayrollItemUpdatePayload({
    baseSalary: Number(item.baseSalary),
    current: {
      bonusAmount: Number(item.bonusAmount),
      deductionAmount: Number(item.deductionAmount),
      advanceDeduction: Number(item.advanceDeduction),
      notes: item.notes,
    },
    update: {
      bonusAmount: input.bonusAmount,
      deductionAmount: input.deductionAmount,
      advanceDeduction: input.advanceDeduction,
      notes: input.notes,
    },
  });

  const netValidation = validatePayrollItemNetPayable(payload.netPayable);
  if (!netValidation.ok) {
    throw new PayrollServiceError(netValidation.message);
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.payrollRunItem.update({
      where: { id: input.itemId },
      data: {
        bonusAmount: payload.bonusAmount,
        deductionAmount: payload.deductionAmount,
        advanceDeduction: payload.advanceDeduction,
        netPayable: payload.netPayable,
        notes: payload.notes,
      },
    });

    const allItems = run.items.map((row) => {
      if (row.id === input.itemId) {
        return {
          baseSalary: Number(item.baseSalary),
          bonusAmount: payload.bonusAmount,
          deductionAmount: payload.deductionAmount,
          advanceDeduction: payload.advanceDeduction,
          netPayable: payload.netPayable,
        };
      }

      return {
        baseSalary: Number(row.baseSalary),
        bonusAmount: Number(row.bonusAmount),
        deductionAmount: Number(row.deductionAmount),
        advanceDeduction: Number(row.advanceDeduction),
        netPayable: Number(row.netPayable),
      };
    });

    const totals = calculatePayrollRunTotals(allItems);

    const refreshed = await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        grossTotal: totals.grossTotal,
        bonusTotal: totals.bonusTotal,
        deductionTotal: totals.deductionTotal,
        netTotal: totals.netTotal,
      },
      include: payrollRunInclude,
    });

    await logPayrollActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYROLL_ITEM_UPDATE",
      message: `${formatEmployeeDisplayName(item.employee)} bordro kalemi güncellendi.`,
    });

    return refreshed;
  });

  const serializedRun = serializePayrollRun(updated);
  const serializedItem = serializedRun.items.find((row) => row.id === input.itemId)!;

  return {
    item: serializedItem,
    payrollRun: serializedRun,
    warning: "warning" in netValidation ? netValidation.warning : undefined,
  };
}

export type SerializedPayrollPeriodPayment = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  typeLabel: string;
  amount: number;
  dueDate: string | null;
  createdAt: string;
  status: string;
  statusLabel: string;
  description: string | null;
};

export async function getPayrollRunPeriodPayments(input: {
  companyId: string;
  payrollRunId: string;
}): Promise<SerializedPayrollPeriodPayment[]> {
  const run = await getPayrollRunInCompany(input.payrollRunId, input.companyId);
  const employeeIds = run.items.map((item) => item.employeeId);

  if (employeeIds.length === 0) {
    return [];
  }

  const payments = await db.employeePayment.findMany({
    where: {
      companyId: input.companyId,
      employeeId: { in: employeeIds },
      type: { in: ["BONUS", "DEDUCTION", "ADVANCE"] },
      status: { in: ["PENDING", "OVERDUE"] },
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  return payments
    .filter((payment) =>
      isPaymentInPayrollPeriod(payment, run.periodStart, run.periodEnd)
    )
    .map((payment) => ({
      id: payment.id,
      employeeId: payment.employeeId,
      employeeName: formatEmployeeDisplayName(payment.employee),
      type: payment.type,
      typeLabel: getPaymentTypeLabel(payment.type),
      amount: Number(payment.amount),
      dueDate: payment.dueDate?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      status: payment.status,
      statusLabel: getPaymentStatusLabel(payment.status),
      description: payment.description,
    }));
}

export async function listPayrollRuns(input: {
  companyId: string;
  status?: PayrollRunStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.PayrollRunWhereInput = {
    companyId: input.companyId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search?.trim()
      ? {
          title: { contains: input.search.trim(), mode: "insensitive" as const },
        }
      : {}),
  };

  const [runs, total] = await Promise.all([
    db.payrollRun.findMany({
      where,
      include: payrollRunInclude,
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.payrollRun.count({ where }),
  ]);

  return {
    payrollRuns: runs.map(serializePayrollRun),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getPayrollDashboardStats(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [monthRuns, pendingRuns, paidRuns, pendingPayments] = await Promise.all([
    db.payrollRun.findMany({
      where: {
        companyId,
        periodStart: { lte: monthEnd },
        periodEnd: { gte: monthStart },
        status: { not: "CANCELLED" },
      },
      select: { netTotal: true },
    }),
    db.payrollRun.count({
      where: {
        companyId,
        status: { in: ["DRAFT", "APPROVED"] },
      },
    }),
    db.payrollRun.count({
      where: { companyId, status: "PAID" },
    }),
    db.employeePayment.count({
      where: {
        companyId,
        status: { in: ["PENDING", "OVERDUE"] },
        type: "SALARY",
      },
    }),
  ]);

  const monthlyNetTotal = monthRuns.reduce(
    (sum, run) => sum + Number(run.netTotal),
    0
  );

  return {
    monthlyNetTotal,
    pendingPayrollCount: pendingRuns,
    paidPayrollCount: paidRuns,
    pendingSalaryPayments: pendingPayments,
  };
}

export type SerializedPayrollRun = ReturnType<typeof serializePayrollRun>;
