import type {
  Employee,
  EmployeeEmploymentType,
  EmployeeLeaveStatus,
  EmployeeLeaveType,
  EmployeePaymentDirection,
  EmployeePaymentStatus,
  EmployeePaymentType,
  EmployeeSalaryPeriod,
  EmployeeStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  buildEmployeeActionUrl,
  calculateEmployeeBalance,
  calculateLeaveDays,
  formatEmployeeDisplayName,
  getEmploymentTypeLabel,
  getEmployeeStatusLabel,
  getLeaveStatusLabel,
  getPaymentStatusLabel,
  getSalaryPeriodLabel,
  normalizeEmployeeInput,
  validateEmployeeInput,
} from "@/lib/employee-utils";
import { createNotification } from "@/lib/notification-service";
import { formatMoney } from "@/lib/format-utils";
import { getUserRoleLabel } from "@/lib/settings-utils";
import { parsePosUsernameFromEmail } from "@/lib/employee-pos-utils";
import {
  resolveEmployeeDepartmentLabel,
  resolveEmployeeDepartmentName,
} from "@/lib/employee-department-utils";
import { resolveEmployeeDepartmentAssignment } from "@/lib/employee-department-service";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { ensureExpenseCategoryExists } from "@/lib/expense-category-service";
import {
  buildEmployeePaymentExpenseTitle,
  buildEmployeePaymentTransactionTitle,
  buildEmployeeAdvanceTransactionTitle,
  buildEmployeePaymentsActionUrl,
  buildMarkPaymentPaidFinanceResult,
  EMPLOYEE_EXPENSE_CATEGORY,
  resolveEmployeePaymentFinancePlan,
  type MarkPaymentPaidFinanceResult,
} from "@/lib/employee-payment-finance-utils";
import {
  buildEmployeeLedgerRows,
  calculateEmployeeCurrentBalance,
  type EmployeeLedgerRow,
} from "@/lib/employee-ledger-utils";
import {
  normalizeSalaryPatchInput,
  salaryAmountChanged,
} from "@/lib/employee-salary-utils";
import { getEmployeePerformanceDetail } from "@/lib/employee-performance-service";
import {
  getFinanceAccountTypeLabel,
} from "@/lib/finance-account-utils";
import {
  EMPLOYEE_PAYMENT_VALIDATION_MESSAGES,
  validateEmployeePaymentAccount,
  validateEmployeePaymentCreateInput,
} from "@/lib/employee-payment-validation";
import { getCompanyAllowNegativeCashBalance } from "@/lib/cash-balance-policy";
import {
  getEmployeePaymentTypeBehavior,
} from "@/lib/employee-payment-type-mapping";

export class EmployeeServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EmployeeServiceError";
    this.status = status;
  }
}

type DbClient = Prisma.TransactionClient | typeof db;

async function assertFinancePaymentAccount(
  client: DbClient,
  companyId: string,
  accountId: string,
  paymentCurrency: string,
  options?: {
    amount?: number;
    checkBalance?: boolean;
    allowNegativeCashBalance?: boolean;
  }
) {
  const account = await client.account.findFirst({
    where: { id: accountId },
  });

  const validation = validateEmployeePaymentAccount(account, companyId, {
    paymentCurrency,
    amount: options?.amount,
    checkBalance: options?.checkBalance,
    allowNegativeCashBalance: options?.allowNegativeCashBalance,
  });

  if (!validation.ok) {
    throw new EmployeeServiceError(validation.message);
  }

  return validation.account;
}

const employeeInclude = {
  companyUser: {
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  },
  departmentRef: {
    select: { id: true, name: true, color: true, isActive: true },
  },
  salaryRecords: {
    orderBy: { effectiveFrom: "desc" as const },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    include: {
      relatedAccount: {
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
        },
      },
    },
  },
  leaveRequests: {
    orderBy: { startAt: "desc" as const },
  },
} satisfies Prisma.EmployeeInclude;

async function getEmployeeInCompany(employeeId: string, companyId: string) {
  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId },
    include: employeeInclude,
  });

  if (!employee) {
    throw new EmployeeServiceError("Çalışan bulunamadı.", 404);
  }

  return employee;
}

async function assertCompanyUserLinkable(
  companyUserId: string,
  companyId: string,
  excludeEmployeeId?: string
) {
  const companyUser = await db.companyUser.findFirst({
    where: { id: companyUserId, companyId },
    include: { user: true },
  });

  if (!companyUser) {
    throw new EmployeeServiceError("Firma kullanıcısı bulunamadı.", 404);
  }

  const existing = await db.employee.findFirst({
    where: {
      companyId,
      companyUserId,
      ...(excludeEmployeeId ? { NOT: { id: excludeEmployeeId } } : {}),
    },
  });

  if (existing) {
    throw new EmployeeServiceError(
      "Bu kullanıcı hesabı başka bir çalışana bağlı.",
      409
    );
  }

  return companyUser;
}

async function logEmployeeActivity(
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

function serializeSalary(
  salary: {
    id: string;
    amount: Prisma.Decimal;
    grossAmount?: Prisma.Decimal | null;
    currency: string;
    period: EmployeeSalaryPeriod;
    paymentDay?: number | null;
    iban?: string | null;
    bankName?: string | null;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    notes: string | null;
  }
) {
  return {
    id: salary.id,
    amount: Number(salary.amount),
    netSalary: Number(salary.amount),
    grossAmount:
      salary.grossAmount != null ? Number(salary.grossAmount) : null,
    currency: salary.currency,
    period: salary.period,
    periodLabel: getSalaryPeriodLabel(salary.period),
    paymentDay: salary.paymentDay ?? null,
    iban: salary.iban ?? null,
    bankName: salary.bankName ?? null,
    effectiveFrom: salary.effectiveFrom.toISOString(),
    effectiveTo: salary.effectiveTo?.toISOString() ?? null,
    isActive: salary.isActive,
    notes: salary.notes,
  };
}

function serializePayment(
  payment: {
    id: string;
    type: EmployeePaymentType;
    direction: EmployeePaymentDirection;
    amount: Prisma.Decimal;
    currency: string;
    dueDate: Date | null;
    paidAt: Date | null;
    status: EmployeePaymentStatus;
    description: string | null;
    relatedExpenseId: string | null;
    relatedAccountId: string | null;
    relatedTransactionId: string | null;
    createdAt: Date;
    createdByUserId?: string | null;
    relatedAccount?: {
      id: string;
      name: string;
      type: string;
      currency: string;
    } | null;
  },
  options?: { createdByName?: string | null }
) {
  const account = payment.relatedAccount;

  return {
    id: payment.id,
    type: payment.type,
    direction: payment.direction,
    amount: Number(payment.amount),
    currency: payment.currency,
    dueDate: payment.dueDate?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    status: payment.status,
    statusLabel: getPaymentStatusLabel(payment.status),
    description: payment.description,
    relatedExpenseId: payment.relatedExpenseId,
    relatedAccountId: payment.relatedAccountId,
    relatedTransactionId: payment.relatedTransactionId,
    paymentAccount: account
      ? {
          id: account.id,
          name: account.name,
          type: account.type,
          typeLabel: getFinanceAccountTypeLabel(account.type),
          currency: account.currency,
        }
      : null,
    paymentMethodLabel: account
      ? getFinanceAccountTypeLabel(account.type)
      : null,
    advanceSettlementRemaining:
      payment.type === "ADVANCE" &&
      (payment.status === "PAID" || payment.direction === "PAID")
        ? Number(payment.amount)
        : null,
    createdByName: options?.createdByName ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

function serializeLeave(
  leave: {
    id: string;
    type: EmployeeLeaveType;
    startAt: Date;
    endAt: Date;
    totalDays: Prisma.Decimal | null;
    status: EmployeeLeaveStatus;
    reason: string | null;
    approvedAt: Date | null;
    createdAt: Date;
  }
) {
  return {
    id: leave.id,
    type: leave.type,
    startAt: leave.startAt.toISOString(),
    endAt: leave.endAt.toISOString(),
    totalDays:
      leave.totalDays != null
        ? Number(leave.totalDays)
        : calculateLeaveDays(leave.startAt, leave.endAt),
    status: leave.status,
    statusLabel: getLeaveStatusLabel(leave.status),
    reason: leave.reason,
    approvedAt: leave.approvedAt?.toISOString() ?? null,
    createdAt: leave.createdAt.toISOString(),
  };
}

export function serializeEmployee(
  employee: Employee & {
    companyUser?: {
      id: string;
      role: string;
      status: string;
      user: { id: string; name: string; email: string };
    } | null;
    departmentRef?: {
      id: string;
      name: string;
      color: string | null;
      isActive: boolean;
    } | null;
    salaryRecords?: Array<{
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      period: EmployeeSalaryPeriod;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      isActive: boolean;
      notes: string | null;
    }>;
    payments?: Array<Parameters<typeof serializePayment>[0]>;
    leaveRequests?: Array<Parameters<typeof serializeLeave>[0]>;
  },
  options?: {
    includeSensitive?: boolean;
    companyId?: string;
    paymentCreatorNames?: Map<string, string>;
  }
) {
  const activeSalary = employee.salaryRecords?.find((s) => s.isActive);
  const balance = calculateEmployeeBalance(employee.payments ?? []);
  const currentBalance = calculateEmployeeCurrentBalance(employee.payments ?? []);
  const pendingPayments =
    employee.payments?.filter(
      (p) => p.status === "PENDING" || p.status === "OVERDUE"
    ) ?? [];
  const pendingLeaves =
    employee.leaveRequests?.filter((l) => l.status === "PENDING").length ?? 0;
  const activeLeave =
    employee.leaveRequests?.find(
      (l) =>
        l.status === "APPROVED" &&
        new Date(l.endAt) >= new Date() &&
        new Date(l.startAt) <= new Date()
    ) ?? null;

  const hasPosAccess = employee.companyUser?.role === "POS_STAFF";
  const companyId = options?.companyId;
  const posAccount =
    hasPosAccess && employee.companyUser && companyId
      ? {
          username:
            parsePosUsernameFromEmail(
              employee.companyUser.user.email,
              companyId
            ) ?? employee.companyUser.user.email,
          status: employee.companyUser.status,
          statusLabel:
            employee.companyUser.status === "ACTIVE" ? "Aktif" : "Pasif",
        }
      : null;

  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: formatEmployeeDisplayName(employee),
    email: employee.email,
    phone: employee.phone,
    avatarUrl: employee.avatarUrl,
    ...(options?.includeSensitive
      ? { nationalId: employee.nationalId }
      : {}),
    jobTitle: employee.jobTitle,
    department: resolveEmployeeDepartmentName({
      department: employee.department,
      departmentRef: employee.departmentRef,
    }),
    departmentId: employee.departmentId,
    departmentInfo: resolveEmployeeDepartmentLabel({
      department: employee.department,
      departmentRef: employee.departmentRef,
    }),
    employmentType: employee.employmentType,
    employmentTypeLabel: getEmploymentTypeLabel(employee.employmentType),
    status: employee.status,
    statusLabel: getEmployeeStatusLabel(employee.status),
    startDate: employee.startDate?.toISOString() ?? null,
    endDate: employee.endDate?.toISOString() ?? null,
    birthDate: employee.birthDate?.toISOString() ?? null,
    address: employee.address,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    notes: employee.notes,
    companyUserId: employee.companyUserId,
    hasUserAccount: Boolean(employee.companyUserId),
    hasPosAccess,
    posAccount,
    paymentSummary: {
      netPayable: balance.netPayable,
      pendingCount: pendingPayments.length,
      pendingTotal: balance.totalPending,
    },
    performanceSummary: {
      thisMonthSales: 0,
      thisMonthSaleCount: 0,
    },
    linkedUser: employee.companyUser
      ? {
          companyUserId: employee.companyUser.id,
          userId: employee.companyUser.user.id,
          name: employee.companyUser.user.name,
          email: employee.companyUser.user.email,
          role: employee.companyUser.role,
          roleLabel: getUserRoleLabel(
            employee.companyUser.role as Parameters<typeof getUserRoleLabel>[0]
          ),
          status: employee.companyUser.status,
        }
      : null,
    activeSalary: activeSalary ? serializeSalary(activeSalary) : null,
    balance,
    currentBalance,
    pendingLeaveCount: pendingLeaves,
    onLeaveNow: Boolean(activeLeave),
    actionUrl: buildEmployeeActionUrl(employee.id),
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
    salaryRecords: employee.salaryRecords?.map(serializeSalary),
    payments: employee.payments?.map((payment) =>
      serializePayment(payment, {
        createdByName: payment.createdByUserId
          ? (options?.paymentCreatorNames?.get(payment.createdByUserId) ?? null)
          : null,
      })
    ),
    leaveRequests: employee.leaveRequests?.map(serializeLeave),
  };
}

export async function createEmployee(input: {
  companyId: string;
  actorUserId: string;
  data: Parameters<typeof normalizeEmployeeInput>[0] & {
    salary?: {
      amount: number;
      grossAmount?: number | null;
      period?: EmployeeSalaryPeriod;
      currency?: string;
      paymentDay?: number | null;
      iban?: string | null;
      bankName?: string | null;
      notes?: string | null;
    };
  };
}) {
  const normalized = normalizeEmployeeInput(input.data);
  const validation = validateEmployeeInput(normalized);

  if (!validation.ok) {
    throw new EmployeeServiceError(validation.message);
  }

  if (normalized.companyUserId) {
    await assertCompanyUserLinkable(normalized.companyUserId, input.companyId);
  }

  const departmentAssignment =
    input.data.departmentId !== undefined
      ? await resolveEmployeeDepartmentAssignment({
          companyId: input.companyId,
          departmentId: input.data.departmentId,
        })
      : undefined;

  const displayName = formatEmployeeDisplayName(normalized);

  const employee = await db.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        companyId: input.companyId,
        companyUserId: normalized.companyUserId,
        firstName: normalized.firstName || displayName.split(" ")[0] || "—",
        lastName:
          normalized.lastName ||
          displayName.split(" ").slice(1).join(" ") ||
          "—",
        email: normalized.email,
        phone: normalized.phone,
        avatarUrl: normalized.avatarUrl,
        nationalId: normalized.nationalId,
        jobTitle: normalized.jobTitle,
        department:
          departmentAssignment?.department ?? normalized.department,
        departmentId: departmentAssignment?.departmentId ?? null,
        employmentType: normalized.employmentType,
        status: normalized.status,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        birthDate: normalized.birthDate,
        address: normalized.address,
        emergencyContactName: normalized.emergencyContactName,
        emergencyContactPhone: normalized.emergencyContactPhone,
        notes: normalized.notes,
      },
      include: employeeInclude,
    });

    if (input.data.salary?.amount != null && input.data.salary.amount > 0) {
      await tx.employeeSalary.create({
        data: {
          companyId: input.companyId,
          employeeId: created.id,
          amount: input.data.salary.amount,
          grossAmount: input.data.salary.grossAmount ?? null,
          currency: input.data.salary.currency ?? "TRY",
          period: input.data.salary.period ?? "MONTHLY",
          paymentDay: input.data.salary.paymentDay ?? null,
          iban: input.data.salary.iban ?? null,
          bankName: input.data.salary.bankName ?? null,
          effectiveFrom: normalized.startDate ?? new Date(),
          isActive: true,
          notes: input.data.salary.notes ?? null,
        },
      });
    }

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "CREATE",
      message: `${displayName} personel kaydı oluşturuldu.`,
    });

    return tx.employee.findUniqueOrThrow({
      where: { id: created.id },
      include: employeeInclude,
    });
  });

  await createNotification({
    companyId: input.companyId,
    category: "TEAM",
    module: "employees",
    entityType: "employee",
    entityId: employee.id,
    actionUrl: buildEmployeeActionUrl(employee.id),
    title: "Yeni çalışan eklendi",
    message: `${displayName} personel kaydı oluşturuldu.`,
  });

  return serializeEmployee(employee, {
    includeSensitive: true,
    companyId: input.companyId,
  });
}

export async function updateEmployeeStatus(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  status: EmployeeStatus;
}) {
  const allowed: EmployeeStatus[] = ["ACTIVE", "PASSIVE", "ON_LEAVE", "TERMINATED"];
  if (!allowed.includes(input.status)) {
    throw new EmployeeServiceError("Geçersiz durum.", 400);
  }

  const existing = await getEmployeeInCompany(input.employeeId, input.companyId);
  const displayName = formatEmployeeDisplayName(existing);

  if (existing.status === input.status) {
    return serializeEmployee(existing, {
      includeSensitive: true,
      companyId: input.companyId,
    });
  }

  const employee = await db.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.employeeId },
      data: { status: input.status },
      include: employeeInclude,
    });

    const message =
      input.status === "PASSIVE"
        ? `${displayName} pasif hale getirildi.`
        : input.status === "ACTIVE"
          ? `${displayName} aktif hale getirildi.`
          : input.status === "TERMINATED"
            ? `${displayName} kaydı sonlandırıldı.`
            : `${displayName} durumu ${getEmployeeStatusLabel(input.status).toLowerCase()} olarak güncellendi.`;

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "UPDATE",
      message,
    });

    return updated;
  });

  return serializeEmployee(employee, {
    includeSensitive: true,
    companyId: input.companyId,
  });
}

export async function updateEmployee(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  data: Parameters<typeof normalizeEmployeeInput>[0];
}) {
  const existing = await getEmployeeInCompany(input.employeeId, input.companyId);
  const normalized = normalizeEmployeeInput(input.data);
  const mergedForValidation = {
    ...normalized,
    firstName: normalized.firstName || existing.firstName,
    lastName: normalized.lastName || existing.lastName,
  };
  const validation = validateEmployeeInput(mergedForValidation);

  if (!validation.ok) {
    throw new EmployeeServiceError(validation.message);
  }

  if (
    normalized.companyUserId &&
    normalized.companyUserId !== existing.companyUserId
  ) {
    await assertCompanyUserLinkable(
      normalized.companyUserId,
      input.companyId,
      input.employeeId
    );
  }

  const departmentAssignment =
    input.data.departmentId !== undefined
      ? await resolveEmployeeDepartmentAssignment({
          companyId: input.companyId,
          departmentId: input.data.departmentId,
        })
      : undefined;

  const previousStatus = existing.status;

  const employee = await db.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.employeeId },
      data: {
        firstName: normalized.firstName || existing.firstName,
        lastName: normalized.lastName || existing.lastName,
        email: normalized.email,
        phone: normalized.phone,
        avatarUrl: normalized.avatarUrl,
        nationalId: normalized.nationalId,
        jobTitle: normalized.jobTitle ?? existing.jobTitle,
        department:
          departmentAssignment !== undefined
            ? departmentAssignment.department
            : normalized.department ?? existing.department,
        departmentId:
          departmentAssignment !== undefined
            ? departmentAssignment.departmentId
            : existing.departmentId,
        employmentType: normalized.employmentType ?? existing.employmentType,
        status: input.data.status ?? existing.status,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        birthDate: normalized.birthDate,
        address: normalized.address,
        emergencyContactName: normalized.emergencyContactName,
        emergencyContactPhone: normalized.emergencyContactPhone,
        notes: normalized.notes,
        companyUserId: normalized.companyUserId,
      },
      include: employeeInclude,
    });

    const displayName = formatEmployeeDisplayName(updated);

    if (previousStatus !== updated.status) {
      const statusMsg =
        updated.status === "PASSIVE" || updated.status === "TERMINATED"
          ? `${displayName} ${getEmployeeStatusLabel(updated.status).toLowerCase()} duruma alındı.`
          : `${displayName} durumu ${getEmployeeStatusLabel(updated.status)} olarak güncellendi.`;

      await logEmployeeActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "UPDATE",
        message: statusMsg,
      });
    } else {
      await logEmployeeActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "UPDATE",
        message: `${displayName} bilgileri güncellendi.`,
      });
    }

    return updated;
  });

  return serializeEmployee(employee, {
    includeSensitive: true,
    companyId: input.companyId,
  });
}

export async function passivateEmployee(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  status?: "PASSIVE" | "TERMINATED";
}) {
  return updateEmployeeStatus({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    employeeId: input.employeeId,
    status: input.status ?? "PASSIVE",
  });
}

export async function deleteEmployeeRecord(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
}) {
  const existing = await getEmployeeInCompany(input.employeeId, input.companyId);

  if (existing.status === "TERMINATED") {
    return serializeEmployee(existing, {
      includeSensitive: true,
      companyId: input.companyId,
    });
  }

  const nextStatus: EmployeeStatus =
    existing.status === "PASSIVE" ? "TERMINATED" : "PASSIVE";

  return updateEmployeeStatus({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    employeeId: input.employeeId,
    status: nextStatus,
  });
}

export async function linkEmployeeToCompanyUser(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  companyUserId: string;
}) {
  await assertCompanyUserLinkable(
    input.companyUserId,
    input.companyId,
    input.employeeId
  );

  const employee = await db.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.employeeId, companyId: input.companyId },
      data: { companyUserId: input.companyUserId },
      include: employeeInclude,
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "LINK",
      message: `${formatEmployeeDisplayName(updated)} sistem hesabına bağlandı.`,
    });

    return updated;
  });

  return serializeEmployee(employee, { includeSensitive: true });
}

export async function unlinkEmployeeFromCompanyUser(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
}) {
  const employee = await db.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: input.employeeId, companyId: input.companyId },
      data: { companyUserId: null },
      include: employeeInclude,
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "UNLINK",
      message: `${formatEmployeeDisplayName(updated)} sistem hesabı bağlantısı kaldırıldı.`,
    });

    return updated;
  });

  return serializeEmployee(employee, { includeSensitive: true });
}

export async function createEmployeeSalary(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  amount: number;
  grossAmount?: number | null;
  period?: EmployeeSalaryPeriod;
  currency?: string;
  paymentDay?: number | null;
  iban?: string | null;
  bankName?: string | null;
  effectiveFrom?: Date;
  notes?: string | null;
}) {
  if (!input.amount || input.amount <= 0) {
    throw new EmployeeServiceError("Geçerli bir maaş tutarı girin.");
  }

  if (
    input.paymentDay != null &&
    (input.paymentDay < 1 || input.paymentDay > 31)
  ) {
    throw new EmployeeServiceError("Maaş ödeme günü 1-31 arasında olmalıdır.");
  }

  await getEmployeeInCompany(input.employeeId, input.companyId);

  const effectiveFrom = input.effectiveFrom ?? new Date();

  await db.$transaction(async (tx) => {
    await tx.employeeSalary.updateMany({
      where: {
        employeeId: input.employeeId,
        companyId: input.companyId,
        isActive: true,
      },
      data: {
        isActive: false,
        effectiveTo: effectiveFrom,
      },
    });

    await tx.employeeSalary.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        amount: input.amount,
        grossAmount: input.grossAmount ?? null,
        currency: input.currency ?? "TRY",
        period: input.period ?? "MONTHLY",
        paymentDay: input.paymentDay ?? null,
        iban: input.iban ?? null,
        bankName: input.bankName ?? null,
        effectiveFrom,
        isActive: true,
        notes: input.notes ?? null,
      },
    });

    const employee = await tx.employee.findUniqueOrThrow({
      where: { id: input.employeeId },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "SALARY",
      message: `Çalışan maaş bilgisi güncellendi: ${formatEmployeeDisplayName(employee)}`,
    });
  });

  await createNotification({
    companyId: input.companyId,
    category: "TEAM",
    module: "employees",
    entityType: "employee",
    entityId: input.employeeId,
    actionUrl: buildEmployeeActionUrl(input.employeeId),
    title: "Maaş güncellendi",
    message: "Çalışan maaş kaydı güncellendi.",
  });

  return getEmployeeById({
    companyId: input.companyId,
    employeeId: input.employeeId,
    includeSensitive: true,
  });
}

export async function updateEmployeeSalary(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  patch: ReturnType<typeof normalizeSalaryPatchInput>;
}) {
  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);
  const activeSalary = employee.salaryRecords.find((salary) => salary.isActive);

  if (!activeSalary) {
    if (!input.patch.amount || input.patch.amount <= 0) {
      throw new EmployeeServiceError("Geçerli bir maaş tutarı girin.");
    }

    return createEmployeeSalary({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      amount: input.patch.amount,
      grossAmount: input.patch.grossAmount,
      period: input.patch.period,
      currency: input.patch.currency,
      paymentDay: input.patch.paymentDay,
      iban: input.patch.iban,
      bankName: input.patch.bankName,
      effectiveFrom: input.patch.effectiveFrom,
      notes: input.patch.notes,
    });
  }

  if (
    input.patch.paymentDay != null &&
    (input.patch.paymentDay < 1 || input.patch.paymentDay > 31)
  ) {
    throw new EmployeeServiceError("Maaş ödeme günü 1-31 arasında olmalıdır.");
  }

  if (
    input.patch.amount != null &&
    (input.patch.amount <= 0 ||
      salaryAmountChanged(Number(activeSalary.amount), input.patch.amount))
  ) {
    return createEmployeeSalary({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      amount: input.patch.amount ?? Number(activeSalary.amount),
      grossAmount:
        input.patch.grossAmount ??
        (activeSalary.grossAmount != null
          ? Number(activeSalary.grossAmount)
          : null),
      period: input.patch.period ?? activeSalary.period,
      currency: input.patch.currency ?? activeSalary.currency,
      paymentDay: input.patch.paymentDay ?? activeSalary.paymentDay,
      iban: input.patch.iban ?? activeSalary.iban,
      bankName: input.patch.bankName ?? activeSalary.bankName,
      effectiveFrom: input.patch.effectiveFrom,
      notes: input.patch.notes ?? activeSalary.notes,
    });
  }

  await db.$transaction(async (tx) => {
    await tx.employeeSalary.update({
      where: { id: activeSalary.id },
      data: {
        grossAmount:
          input.patch.grossAmount !== undefined
            ? input.patch.grossAmount
            : undefined,
        period: input.patch.period,
        currency: input.patch.currency,
        paymentDay:
          input.patch.paymentDay !== undefined
            ? input.patch.paymentDay
            : undefined,
        iban: input.patch.iban !== undefined ? input.patch.iban : undefined,
        bankName:
          input.patch.bankName !== undefined ? input.patch.bankName : undefined,
        notes: input.patch.notes !== undefined ? input.patch.notes : undefined,
        ...(input.patch.effectiveFrom
          ? { effectiveFrom: input.patch.effectiveFrom }
          : {}),
      },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "SALARY",
      message: `Çalışan maaş bilgisi güncellendi: ${formatEmployeeDisplayName(employee)}`,
    });
  });

  return getEmployeeById({
    companyId: input.companyId,
    employeeId: input.employeeId,
    includeSensitive: true,
  });
}

export async function getEmployeeLedger(input: {
  companyId: string;
  employeeId: string;
}): Promise<{
  currentBalance: number;
  entries: EmployeeLedgerRow[];
}> {
  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);
  const entries = buildEmployeeLedgerRows(employee.payments);

  return {
    currentBalance: calculateEmployeeCurrentBalance(employee.payments),
    entries,
  };
}

export type EmployeeLedgerActionType =
  | "SALARY_ACCRUAL"
  | "SALARY_PAYMENT"
  | "ADVANCE"
  | "DEDUCTION"
  | "BONUS"
  | "ADJUSTMENT";

export async function createEmployeeLedgerMovement(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  type: EmployeeLedgerActionType;
  amount: number;
  date?: Date;
  accountId?: string | null;
  description?: string | null;
  direction?: "DEBIT" | "CREDIT";
}) {
  if (!input.amount || input.amount <= 0) {
    throw new EmployeeServiceError("Geçerli bir tutar girin.");
  }

  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);
  const displayName = formatEmployeeDisplayName(employee);
  const movementDate = input.date ?? new Date();
  const description = input.description?.trim() || null;

  if (input.type === "SALARY_ACCRUAL") {
    const payment = await createEmployeePayment({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      type: "SALARY",
      amount: input.amount,
      dueDate: movementDate,
      description: description ?? "Maaş tahakkuku",
    });

    await db.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "SALARY_ACCRUAL",
        module: "employees",
        message: `Maaş tahakkuku eklendi: ${displayName} - ${formatMoney(input.amount)}`,
      },
    });

    return { payment, ledger: await getEmployeeLedger(input) };
  }

  if (input.type === "DEDUCTION") {
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.employeePayment.create({
        data: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          type: "DEDUCTION",
          direction: "DEDUCTED",
          amount: input.amount,
          currency: "TRY",
          dueDate: movementDate,
          paidAt: movementDate,
          status: "PAID",
          description: description ?? "Kesinti",
          createdByUserId: input.actorUserId,
        },
      });

      await logEmployeeActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "DEDUCTION",
        message: `Çalışan kesintisi eklendi: ${displayName} - ${formatMoney(input.amount)}`,
      });

      return created;
    });

    return {
      payment: serializePayment(payment),
      ledger: await getEmployeeLedger(input),
    };
  }

  if (input.type === "ADJUSTMENT") {
    const isDebit = input.direction !== "CREDIT";
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.employeePayment.create({
        data: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          type: "OTHER",
          direction: isDebit ? "PAYABLE" : "PAID",
          amount: input.amount,
          currency: "TRY",
          dueDate: movementDate,
          paidAt: isDebit ? null : movementDate,
          status: isDebit ? "PENDING" : "PAID",
          description: description ?? "Cari düzeltme",
          createdByUserId: input.actorUserId,
        },
      });

      await logEmployeeActivity(tx, {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "LEDGER_ADJUSTMENT",
        message: `Çalışan cari düzeltmesi eklendi: ${displayName}`,
      });

      return created;
    });

    return {
      payment: serializePayment(payment),
      ledger: await getEmployeeLedger(input),
    };
  }

  if (!input.accountId?.trim()) {
    throw new EmployeeServiceError(
      EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired
    );
  }

  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  const account = await assertFinancePaymentAccount(
    db,
    input.companyId,
    input.accountId.trim(),
    "TRY",
    {
      amount: input.amount,
      checkBalance: true,
      allowNegativeCashBalance,
    }
  );

  const paymentType: EmployeePaymentType =
    input.type === "ADVANCE"
      ? "ADVANCE"
      : input.type === "BONUS"
        ? "BONUS"
        : "SALARY";

  const paymentDescription =
    input.description ??
    (paymentType === "ADVANCE"
      ? "Personel avansı"
      : paymentType === "BONUS"
        ? "Prim / ek ödeme"
        : "Çalışan ödemesi");

  const paid = await db.$transaction(async (tx) => {
    const created = await tx.employeePayment.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        type: paymentType,
        direction: "PAYABLE",
        amount: input.amount,
        currency: "TRY",
        dueDate: movementDate,
        status: "PENDING",
        description: paymentDescription,
        relatedAccountId: account.id,
        createdByUserId: input.actorUserId,
      },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYMENT",
      message: `${displayName} için ${paymentType} kaydı oluşturuldu.`,
    });

    return markEmployeePaymentPaidInTx(tx, {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      payment: created,
      paidAt: movementDate,
      relatedAccountId: account.id,
    });
  });

  const actionMessage =
    paymentType === "ADVANCE"
      ? `Çalışan avansı verildi: ${displayName} - ${formatMoney(input.amount)}`
      : paymentType === "BONUS"
        ? `Prim ödemesi yapıldı: ${displayName} - ${formatMoney(input.amount)}`
        : `Çalışan ödemesi yapıldı: ${displayName} - ${formatMoney(input.amount)}`;

  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.actorUserId,
      action:
        paymentType === "ADVANCE"
          ? "ADVANCE"
          : paymentType === "BONUS"
            ? "BONUS"
            : "PAYMENT_PAID",
      module: "employees",
      message: actionMessage,
    },
  });

  return {
    payment: serializePayment(paid.payment),
    finance: buildMarkPaymentPaidFinanceResult({
      expenseCreated: paid.expenseCreated,
      transactionCreated: paid.transactionCreated,
      relatedExpenseId: paid.relatedExpenseId,
      relatedTransactionId: paid.relatedTransactionId,
    }),
    ledger: await getEmployeeLedger(input),
  };
}

export async function createEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  type: EmployeePaymentType;
  direction?: EmployeePaymentDirection;
  amount: number;
  currency?: string;
  dueDate?: Date | null;
  description?: string;
  relatedExpenseId?: string;
  relatedAccountId?: string;
  payImmediately?: boolean;
}) {
  const validation = validateEmployeePaymentCreateInput({
    type: input.type,
    amount: input.amount,
    relatedAccountId: input.relatedAccountId,
    currency: input.currency,
  });

  if (!validation.ok) {
    throw new EmployeeServiceError(validation.message);
  }

  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);
  const typeBehavior = getEmployeePaymentTypeBehavior(input.type);
  const currency = input.currency ?? "TRY";
  const direction =
    input.direction ??
    (input.type === "DEDUCTION" ? "DEDUCTED" : "PAYABLE");
  const payImmediately =
    input.payImmediately === true || validation.payImmediately;
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  if (payImmediately && validation.accountId) {
    const paidAt = input.dueDate ?? new Date();

    const result = await db.$transaction(async (tx) => {
      await assertFinancePaymentAccount(
        tx,
        input.companyId,
        validation.accountId!,
        currency,
        {
          amount: validation.amount,
          checkBalance: true,
          allowNegativeCashBalance,
        }
      );

      const created = await tx.employeePayment.create({
        data: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          type: input.type,
          direction,
          amount: validation.amount,
          currency,
          dueDate: input.dueDate,
          status: "PENDING",
          description: input.description,
          relatedExpenseId: input.relatedExpenseId,
          relatedAccountId: validation.accountId,
          createdByUserId: input.actorUserId,
        },
      });

      const paid = await markEmployeePaymentPaidInTx(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        employeeId: input.employeeId,
        payment: created,
        paidAt,
        relatedAccountId: validation.accountId!,
      });

      return paid.payment;
    });

    return serializePayment(result);
  }

  if (
    typeBehavior.requiresAccountToDisburse &&
    !typeBehavior.allowPendingWithoutAccount &&
    !validation.accountId
  ) {
    throw new EmployeeServiceError(
      EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired
    );
  }

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.employeePayment.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        type: input.type,
        direction,
        amount: validation.amount,
        currency,
        dueDate: input.dueDate,
        status: "PENDING",
        description: input.description,
        relatedExpenseId: input.relatedExpenseId,
        relatedAccountId: validation.accountId,
        createdByUserId: input.actorUserId,
      },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "PAYMENT",
      message: `${formatEmployeeDisplayName(employee)} için ${typeBehavior.label} kaydı oluşturuldu.`,
    });

    return created;
  });

  return serializePayment(payment);
}

export async function markEmployeePaymentPaidInTx(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    actorUserId: string;
    employeeId: string;
    payment: {
      id: string;
      type: EmployeePaymentType;
      direction: EmployeePaymentDirection;
      amount: Prisma.Decimal;
      currency: string;
      status: EmployeePaymentStatus;
      description: string | null;
      relatedExpenseId: string | null;
      relatedAccountId: string | null;
      relatedTransactionId: string | null;
    };
    paidAt: Date;
    relatedAccountId: string;
    notes?: string;
  }
) {
  const plan = resolveEmployeePaymentFinancePlan({
    status: input.payment.status,
    relatedExpenseId: input.payment.relatedExpenseId,
    relatedTransactionId: input.payment.relatedTransactionId,
    relatedAccountId: input.relatedAccountId,
  });

  if (plan.isAlreadyPaid) {
    const existing = await tx.employeePayment.findFirstOrThrow({
      where: { id: input.payment.id },
      include: {
        relatedAccount: {
          select: { id: true, name: true, type: true, currency: true },
        },
      },
    });

    return {
      payment: existing,
      expenseCreated: false,
      transactionCreated: false,
      relatedExpenseId: existing.relatedExpenseId,
      relatedTransactionId: existing.relatedTransactionId,
      displayName: "",
      amountLabel: "",
      skipNotification: true as const,
    };
  }

  if (!plan.accountId) {
    throw new EmployeeServiceError(
      EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired
    );
  }

  const typeBehavior = getEmployeePaymentTypeBehavior(input.payment.type);
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  await assertFinancePaymentAccount(
    tx,
    input.companyId,
    plan.accountId,
    input.payment.currency,
    {
      amount: roundCashMoney(Number(input.payment.amount)),
      checkBalance: true,
      allowNegativeCashBalance,
    }
  );

  const amount = roundCashMoney(Number(input.payment.amount));
  let relatedExpenseId = input.payment.relatedExpenseId;
  let relatedTransactionId = input.payment.relatedTransactionId;
  let expenseCreated = false;
  let transactionCreated = false;

  if (plan.createExpense) {
    await ensureExpenseCategoryExists(input.companyId, EMPLOYEE_EXPENSE_CATEGORY);
  }

  const employee = await tx.employee.findUniqueOrThrow({
    where: { id: input.employeeId },
  });
  const displayName = formatEmployeeDisplayName(employee);
  const expenseTitle = typeBehavior.buildExpenseTitle(displayName);
  const note = input.notes?.trim() || input.payment.description || null;

  if (plan.createExpense) {
    const expense = await tx.expense.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        title: expenseTitle,
        category: typeBehavior.expenseCategory,
        amount,
        status: "APPROVED",
        paymentStatus: "PAID",
        accountId: plan.accountId,
        date: input.paidAt,
        note,
      },
    });

    relatedExpenseId = expense.id;
    expenseCreated = true;

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "CREATE",
        module: "expenses",
        message: `${expense.title} gideri oluşturuldu (ödendi).`,
      },
    });
  }

  if (plan.createTransaction && plan.accountId && !relatedTransactionId) {
    const account = await tx.account.findFirstOrThrow({
      where: {
        id: plan.accountId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    });
    const currentBalance = roundCashMoney(Number(account.balance));
    if (currentBalance < amount) {
      throw new EmployeeServiceError(
        EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.insufficientBalance
      );
    }
    const newBalance = roundCashMoney(currentBalance - amount);

    const transaction = await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "EXPENSE",
        title: typeBehavior.buildTransactionTitle(displayName),
        amount,
        date: input.paidAt,
        note,
        ...(relatedExpenseId ? { expenseId: relatedExpenseId } : {}),
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    if (relatedExpenseId && !expenseCreated) {
      await tx.expense.updateMany({
        where: {
          id: relatedExpenseId,
          companyId: input.companyId,
        },
        data: {
          paymentStatus: "PAID",
          accountId: account.id,
        },
      });
    }

    relatedTransactionId = transaction.id;
    transactionCreated = true;
  }

  const result = await tx.employeePayment.update({
    where: { id: input.payment.id },
    data: {
      status: "PAID",
      direction: typeBehavior.paidDirection,
      paidAt: input.paidAt,
      relatedExpenseId,
      relatedTransactionId,
      relatedAccountId: plan.accountId,
      ...(input.notes
        ? {
            description: input.payment.description
              ? `${input.payment.description} — ${input.notes}`
              : input.notes,
          }
        : {}),
    },
    include: {
      relatedAccount: {
        select: { id: true, name: true, type: true, currency: true },
      },
    },
  });

  const amountLabel = formatMoney(Number(input.payment.amount));

  await logEmployeeActivity(tx, {
    companyId: input.companyId,
    userId: input.actorUserId,
    action: "PAYMENT_PAID",
    message: `${displayName} için ${amountLabel} çalışan ödemesi ödendi olarak işaretlendi.`,
  });

  return {
    payment: result,
    expenseCreated,
    transactionCreated,
    relatedExpenseId,
    relatedTransactionId,
    displayName,
    amountLabel,
    skipNotification: false as const,
  };
}

export async function markEmployeePaymentPaid(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  paymentId: string;
  paidAt?: Date;
  relatedAccountId?: string | null;
  notes?: string;
}): Promise<{
  payment: ReturnType<typeof serializePayment>;
  finance: MarkPaymentPaidFinanceResult;
}> {
  const payment = await db.employeePayment.findFirst({
    where: {
      id: input.paymentId,
      employeeId: input.employeeId,
      companyId: input.companyId,
    },
  });

  if (!payment) {
    throw new EmployeeServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  if (payment.status === "CANCELLED") {
    throw new EmployeeServiceError("İptal edilmiş ödeme işaretlenemez.");
  }

  const accountId = (
    input.relatedAccountId?.trim() ||
    payment.relatedAccountId?.trim() ||
    ""
  );

  if (payment.status !== "PAID" && !accountId) {
    throw new EmployeeServiceError(
      EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired
    );
  }

  const paidAt = input.paidAt ?? new Date();

  const updated = await db.$transaction(async (tx) =>
    markEmployeePaymentPaidInTx(tx, {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      payment,
      paidAt,
      relatedAccountId: accountId,
      notes: input.notes,
    })
  );

  if (!updated.skipNotification) {
    await createNotification({
      companyId: input.companyId,
      category: "FINANCE",
      module: "employees",
      entityType: "EMPLOYEE_PAYMENT",
      entityId: payment.id,
      actionUrl: buildEmployeePaymentsActionUrl(input.employeeId),
      priority: "NORMAL",
      title: "Çalışan ödemesi tamamlandı",
      message: `${updated.displayName} için ${updated.amountLabel} ödeme ödendi olarak işaretlendi.`,
    });
  }

  return {
    payment: serializePayment(updated.payment),
    finance: buildMarkPaymentPaidFinanceResult({
      expenseCreated: updated.expenseCreated,
      transactionCreated: updated.transactionCreated,
      relatedExpenseId: updated.relatedExpenseId,
      relatedTransactionId: updated.relatedTransactionId,
    }),
  };
}

export async function updateEmployeePaymentStatus(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  paymentId: string;
  status: EmployeePaymentStatus;
  paidAt?: Date;
  relatedAccountId?: string | null;
  notes?: string;
}) {
  if (input.status === "PAID") {
    return markEmployeePaymentPaid({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      paymentId: input.paymentId,
      paidAt: input.paidAt,
      relatedAccountId: input.relatedAccountId,
      notes: input.notes,
    });
  }

  const payment = await db.employeePayment.update({
    where: {
      id: input.paymentId,
      employeeId: input.employeeId,
      companyId: input.companyId,
    },
    data: { status: input.status },
  });

  return serializePayment(payment);
}

async function findOverlappingLeave(
  employeeId: string,
  companyId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
) {
  return db.employeeLeave.findFirst({
    where: {
      employeeId,
      companyId,
      status: { in: ["PENDING", "APPROVED"] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      startAt: { lte: endAt },
      endAt: { gte: startAt },
    },
  });
}

export async function createEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  type: EmployeeLeaveType;
  startAt: Date;
  endAt: Date;
  reason?: string;
  status?: EmployeeLeaveStatus;
}) {
  if (input.endAt < input.startAt) {
    throw new EmployeeServiceError("İzin bitiş tarihi başlangıçtan önce olamaz.");
  }

  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);
  const overlap = await findOverlappingLeave(
    input.employeeId,
    input.companyId,
    input.startAt,
    input.endAt
  );

  if (overlap) {
    throw new EmployeeServiceError(
      "Bu tarihlerde çakışan bir izin kaydı var.",
      409
    );
  }

  const status = input.status ?? "PENDING";
  const totalDays = calculateLeaveDays(input.startAt, input.endAt);

  const leave = await db.$transaction(async (tx) => {
    const created = await tx.employeeLeave.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        type: input.type,
        startAt: input.startAt,
        endAt: input.endAt,
        totalDays,
        status,
        reason: input.reason,
        createdByUserId: input.actorUserId,
        ...(status === "APPROVED"
          ? {
              approvedByUserId: input.actorUserId,
              approvedAt: new Date(),
            }
          : {}),
      },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "LEAVE",
      message: `${formatEmployeeDisplayName(employee)} için izin talebi oluşturuldu.`,
    });

    if (status === "APPROVED") {
      await tx.employee.update({
        where: { id: input.employeeId },
        data: { status: "ON_LEAVE" },
      });
    }

    return created;
  });

  await createNotification({
    companyId: input.companyId,
    category: "TEAM",
    module: "employees",
    entityType: "employee_leave",
    entityId: leave.id,
    actionUrl: buildEmployeeActionUrl(input.employeeId),
    title: status === "APPROVED" ? "İzin onaylandı" : "Yeni izin talebi",
    message: `${formatEmployeeDisplayName(employee)} — ${totalDays} gün izin.`,
  });

  return serializeLeave(leave);
}

export async function approveEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  leaveId: string;
}) {
  const leave = await db.employeeLeave.findFirst({
    where: {
      id: input.leaveId,
      employeeId: input.employeeId,
      companyId: input.companyId,
    },
  });

  if (!leave) {
    throw new EmployeeServiceError("İzin kaydı bulunamadı.", 404);
  }

  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.employeeLeave.update({
      where: { id: leave.id },
      data: {
        status: "APPROVED",
        approvedByUserId: input.actorUserId,
        approvedAt: new Date(),
      },
    });

    await tx.employee.update({
      where: { id: input.employeeId },
      data: { status: "ON_LEAVE" },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "LEAVE_APPROVE",
      message: `${formatEmployeeDisplayName(employee)} izin talebi onaylandı.`,
    });

    return result;
  });

  await createNotification({
    companyId: input.companyId,
    category: "TEAM",
    module: "employees",
    entityType: "employee_leave",
    entityId: leave.id,
    actionUrl: buildEmployeeActionUrl(input.employeeId),
    title: "İzin onaylandı",
    message: `${formatEmployeeDisplayName(employee)} izin talebi onaylandı.`,
  });

  // TODO(calendar): APPROVED leave → CalendarEvent source SYSTEM relatedType EMPLOYEE_LEAVE

  return serializeLeave(updated);
}

export async function rejectEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  leaveId: string;
}) {
  const leave = await db.employeeLeave.findFirst({
    where: {
      id: input.leaveId,
      employeeId: input.employeeId,
      companyId: input.companyId,
    },
  });

  if (!leave) {
    throw new EmployeeServiceError("İzin kaydı bulunamadı.", 404);
  }

  const employee = await getEmployeeInCompany(input.employeeId, input.companyId);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.employeeLeave.update({
      where: { id: leave.id },
      data: { status: "REJECTED" },
    });

    await logEmployeeActivity(tx, {
      companyId: input.companyId,
      userId: input.actorUserId,
      action: "LEAVE_REJECT",
      message: `${formatEmployeeDisplayName(employee)} izin talebi reddedildi.`,
    });

    return result;
  });

  await createNotification({
    companyId: input.companyId,
    category: "TEAM",
    module: "employees",
    entityType: "employee_leave",
    entityId: leave.id,
    actionUrl: buildEmployeeActionUrl(input.employeeId),
    title: "İzin reddedildi",
    message: `${formatEmployeeDisplayName(employee)} izin talebi reddedildi.`,
  });

  return serializeLeave(updated);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export async function getEmployeePerformance(input: {
  companyId: string;
  employeeId: string;
  from?: Date | string | null;
  to?: Date | string | null;
}) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
    select: { id: true },
  });

  if (!employee) {
    throw new EmployeeServiceError("Çalışan bulunamadı.", 404);
  }

  try {
    return await getEmployeePerformanceDetail(input);
  } catch (error) {
    throw new EmployeeServiceError(
      error instanceof Error ? error.message : "Performans verisi alınamadı."
    );
  }
}

export type ListEmployeesFilters = {
  tab?: string;
  search?: string;
  department?: string;
  employmentType?: EmployeeEmploymentType;
  status?: EmployeeStatus;
  hasUserAccount?: boolean;
  sort?: string;
};

export async function listEmployees(input: {
  companyId: string;
  filters?: ListEmployeesFilters;
}) {
  const tab = input.filters?.tab ?? "active";
  const search = input.filters?.search?.trim().toLowerCase();
  const department = input.filters?.department?.trim();
  const sort = input.filters?.sort ?? "name";

  const statusFilter: EmployeeStatus | undefined =
    input.filters?.status ??
    (tab === "active"
      ? "ACTIVE"
      : tab === "on_leave"
        ? "ON_LEAVE"
        : tab === "passive"
          ? "PASSIVE"
          : tab === "terminated"
            ? "TERMINATED"
            : undefined);

  const where: Prisma.EmployeeWhereInput = {
    companyId: input.companyId,
    ...(statusFilter && tab !== "all" ? { status: statusFilter } : {}),
    ...(department ? { department } : {}),
    ...(input.filters?.employmentType
      ? { employmentType: input.filters.employmentType }
      : {}),
    ...(input.filters?.hasUserAccount === true
      ? { companyUserId: { not: null } }
      : input.filters?.hasUserAccount === false
        ? { companyUserId: null }
        : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { jobTitle: { contains: search, mode: "insensitive" } },
            { department: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const employees = await db.employee.findMany({
    where,
    include: employeeInclude,
    orderBy:
      sort === "createdAt"
        ? { createdAt: "desc" }
        : sort === "startDate"
          ? { startDate: "desc" }
          : { lastName: "asc" },
  });

  let sorted = employees;
  if (sort === "salary") {
    sorted = [...employees].sort((a, b) => {
      const sa = Number(
        a.salaryRecords.find((s) => s.isActive)?.amount ?? 0
      );
      const sb = Number(
        b.salaryRecords.find((s) => s.isActive)?.amount ?? 0
      );
      return sb - sa;
    });
  } else if (sort === "name") {
    sorted = [...employees].sort((a, b) =>
      formatEmployeeDisplayName(a).localeCompare(formatEmployeeDisplayName(b), "tr")
    );
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const serialized = sorted.map((e) =>
    serializeEmployee(e, { companyId: input.companyId })
  );

  const linkedUserIds = sorted
    .map((e) => e.companyUserId)
    .filter(Boolean) as string[];

  const performanceByEmployeeId = new Map<
    string,
    { thisMonthSales: number; thisMonthSaleCount: number }
  >();

  if (linkedUserIds.length > 0) {
    const companyUsers = await db.companyUser.findMany({
      where: { id: { in: linkedUserIds }, companyId: input.companyId },
      select: { id: true, userId: true },
    });
    const userIdByCompanyUserId = new Map(
      companyUsers.map((cu) => [cu.id, cu.userId])
    );
    const userIds = companyUsers.map((cu) => cu.userId);

    if (userIds.length > 0) {
      const sales = await db.sale.groupBy({
        by: ["userId"],
        where: {
          companyId: input.companyId,
          userId: { in: userIds },
          status: "COMPLETED",
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
        _count: { id: true },
      });

      for (const employee of sorted) {
        if (!employee.companyUserId) continue;
        const userId = userIdByCompanyUserId.get(employee.companyUserId);
        if (!userId) continue;
        const row = sales.find((s) => s.userId === userId);
        performanceByEmployeeId.set(employee.id, {
          thisMonthSales: Number(row?._sum.total ?? 0),
          thisMonthSaleCount: row?._count.id ?? 0,
        });
      }
    }
  }

  const enriched = serialized.map((employee) => ({
    ...employee,
    performanceSummary:
      performanceByEmployeeId.get(employee.id) ?? employee.performanceSummary,
  }));

  const allEmployees = await db.employee.findMany({
    where: { companyId: input.companyId },
    include: {
      salaryRecords: { where: { isActive: true } },
      payments: { where: { status: { in: ["PENDING", "OVERDUE"] } } },
      leaveRequests: { where: { status: "PENDING" } },
      companyUser: { select: { role: true } },
    },
  });

  const summary = {
    activeCount: allEmployees.filter((e) => e.status === "ACTIVE").length,
    onLeaveCount: allEmployees.filter((e) => e.status === "ON_LEAVE").length,
    passiveCount: allEmployees.filter((e) => e.status === "PASSIVE").length,
    terminatedCount: allEmployees.filter((e) => e.status === "TERMINATED")
      .length,
    totalCount: allEmployees.length,
    monthlyPayable: allEmployees.reduce((sum, e) => {
      const salary = Number(e.salaryRecords[0]?.amount ?? 0);
      const pending = e.payments.reduce((p, pay) => p + Number(pay.amount), 0);
      return sum + salary + pending;
    }, 0),
    pendingLeaveCount: allEmployees.reduce(
      (sum, e) => sum + e.leaveRequests.length,
      0
    ),
    pendingPaymentCount: allEmployees.reduce(
      (sum, e) => sum + e.payments.length,
      0
    ),
    withUserAccountCount: allEmployees.filter((e) => e.companyUserId).length,
    withPosAccessCount: allEmployees.filter(
      (e) => e.companyUser?.role === "POS_STAFF"
    ).length,
    salesThisMonthEmployeeCount: enriched.filter(
      (e) => e.performanceSummary.thisMonthSaleCount > 0
    ).length,
  };

  const linkedUserIdsForSales = allEmployees
    .map((e) => e.companyUserId)
    .filter(Boolean);

  let thisMonthSalesTotal = 0;
  if (linkedUserIdsForSales.length > 0) {
    const companyUsers = await db.companyUser.findMany({
      where: { id: { in: linkedUserIdsForSales as string[] }, companyId: input.companyId },
      select: { userId: true },
    });
    const userIds = companyUsers.map((cu) => cu.userId);
    if (userIds.length > 0) {
      const agg = await db.sale.aggregate({
        where: {
          companyId: input.companyId,
          userId: { in: userIds },
          status: "COMPLETED",
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { total: true },
      });
      thisMonthSalesTotal = Number(agg._sum.total ?? 0);
    }
  }

  return {
    employees: enriched,
    summary: {
      ...summary,
      thisMonthSalesTotal,
    },
  };
}

export async function getEmployeeById(input: {
  companyId: string;
  employeeId: string;
  includeSensitive?: boolean;
}) {
  const employee = await getEmployeeInCompany(
    input.employeeId,
    input.companyId
  );

  const activities = await db.activityLog.findMany({
    where: {
      companyId: input.companyId,
      module: "employees",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const filteredActivities = activities.filter((a) =>
    a.message?.includes(formatEmployeeDisplayName(employee))
  );

  const performance = await getEmployeePerformance({
    companyId: input.companyId,
    employeeId: input.employeeId,
  });

  const creatorIds = [
    ...new Set(
      (employee.payments ?? [])
        .map((payment) => payment.createdByUserId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const creators =
    creatorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true },
        })
      : [];

  const paymentCreatorNames = new Map(
    creators.map((creator) => [creator.id, creator.name])
  );

  return {
    employee: serializeEmployee(employee, {
      includeSensitive: input.includeSensitive,
      companyId: input.companyId,
      paymentCreatorNames,
    }),
    performance,
    activities: filteredActivities.map((a) => ({
      id: a.id,
      action: a.action,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function getUnlinkedCompanyUsers(companyId: string) {
  const [users, linked] = await Promise.all([
    db.companyUser.findMany({
      where: { companyId, status: "ACTIVE" },
      include: { user: true },
    }),
    db.employee.findMany({
      where: { companyId, companyUserId: { not: null } },
      select: { companyUserId: true },
    }),
  ]);

  const linkedIds = new Set(linked.map((e) => e.companyUserId));

  return users
    .filter((u) => !linkedIds.has(u.id))
    .map((u) => ({
      id: u.id,
      userId: u.userId,
      name: u.user.name,
      email: u.user.email,
      role: u.role,
      roleLabel: getUserRoleLabel(u.role),
    }));
}
