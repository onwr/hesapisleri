import { z } from "zod";
import { db } from "@/lib/prisma";
import {
  createEmployee,
  updateEmployee,
  createEmployeeLeave,
  approveEmployeeLeave,
  rejectEmployeeLeave,
  cancelEmployeeLeave,
  getEmployeePerformance,
  listEmployees,
  getEmployeeById,
  EmployeeServiceError,
} from "@/lib/employee-service";
import { listEmployeeDepartments } from "@/lib/employee-department-service";
import { getEmployeeModulePermissions, hasEmployeeApiPermission, canViewEmployeeSalary } from "@/lib/employee-permission-utils";
import type { UserRole } from "@prisma/client";
import { MobileFinanceError } from "./mobile-finance-errors";
import { executeIdempotentEmployeePayment } from "./employee-payment-idempotency";

const LIST_PAGE_SIZE = 20;
const SUB_PAGE_SIZE = 20;

function toMinor(amount: number) {
  return Math.round(amount * 100);
}

function periodLabel(periodStart: Date, periodEnd: Date) {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return `${fmt(periodStart)} — ${fmt(periodEnd)}`;
}

// Web'de ayrı bir canonical leave-type label fonksiyonu yok — yalnız görüntü
// etiketi, gerçek Prisma enum değerleriyle birebir eşleşiyor (yeni değer icat edilmedi).
const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Yıllık İzin",
  SICK: "Hastalık İzni",
  UNPAID: "Ücretsiz İzin",
  EXCUSE: "Mazeret İzni",
  REMOTE: "Uzaktan Çalışma",
  OTHER: "Diğer",
};
function leaveTypeLabel(type: string) {
  return LEAVE_TYPE_LABELS[type] ?? type;
}

function requireView(role: string, isOwner: boolean) {
  const perms = getEmployeeModulePermissions(role as UserRole, isOwner);
  if (!perms.canView) {
    throw new MobileFinanceError("FORBIDDEN", "Çalışan görüntüleme yetkiniz yok.", 403);
  }
  return perms;
}

function requireManage(role: string, isOwner: boolean) {
  if (!hasEmployeeApiPermission(role as UserRole, "manageRecords", isOwner)) {
    throw new MobileFinanceError("FORBIDDEN", "Bu işlem için yetkiniz yok.", 403);
  }
}

function mobileEmployeePermissions(role: string, isOwner: boolean) {
  const perms = getEmployeeModulePermissions(role as UserRole, isOwner);
  return {
    canRead: perms.canView,
    canUpdate: perms.canManageRecords,
    canCreatePayment: perms.canProcessPayments,
    canManageLeave: perms.canManageRecords,
    canCreatePerformance: false, // performans yalnız salt-okunur — bkz. servis üstü not
  };
}

/** Maaş görünürlüğü — açık canonical policy helper (employee-permission-utils.ts).
 * Liste ve detay DTO'sunda aynı fonksiyon kullanılır. */
function canViewSalary(role: string, isOwner: boolean) {
  const perms = getEmployeeModulePermissions(role as UserRole, isOwner);
  return canViewEmployeeSalary(role as UserRole, perms);
}

function stripSalaryIfNeeded<T extends { activeSalary: unknown; salaryRecords?: unknown }>(
  employee: T,
  canSeeSalary: boolean
): T {
  if (canSeeSalary) return employee;
  return { ...employee, activeSalary: null, salaryRecords: undefined };
}

// ─────────────────────────────────────────────────────────────────────────
// Liste
// ─────────────────────────────────────────────────────────────────────────

export type MobileEmployeesListFilters = {
  search?: string;
  departmentId?: string;
  employmentStatus?: string;
  leaveStatus?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
};

export async function listMobileEmployees(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  filters: MobileEmployeesListFilters;
}) {
  requireView(input.role, input.isOwner);
  const canSeeSalary = canViewSalary(input.role, input.isOwner);
  const permissions = mobileEmployeePermissions(input.role, input.isOwner);

  const { filters } = input;
  const { employees, summary } = await listEmployees({
    companyId: input.companyId,
    filters: {
      tab: "all",
      search: filters.search,
      status: filters.employmentStatus as never,
      sort: (filters.sort as never) ?? "name",
    },
  });

  let rows = employees;
  if (filters.departmentId) {
    rows = rows.filter((e) => e.departmentId === filters.departmentId);
  }
  if (filters.isActive === true) {
    rows = rows.filter((e) => e.status === "ACTIVE");
  } else if (filters.isActive === false) {
    rows = rows.filter((e) => e.status !== "ACTIVE");
  }
  if (filters.leaveStatus === "on_leave") {
    rows = rows.filter((e) => e.onLeaveNow);
  } else if (filters.leaveStatus === "pending") {
    rows = rows.filter((e) => e.pendingLeaveCount > 0);
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? LIST_PAGE_SIZE));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    permissions,
    items: pageRows.map((e) => {
      const safe = stripSalaryIfNeeded(e, canSeeSalary);
      return {
        id: e.id,
        employeeCode: null as string | null, // Employee modelinde employeeCode alanı yok
        firstName: e.firstName,
        lastName: e.lastName,
        fullName: e.fullName,
        phone: e.phone,
        email: e.email,
        position: e.jobTitle,
        department: e.departmentId ? { id: e.departmentId, name: e.department } : null,
        employmentStatus: e.status,
        employmentStatusLabel: e.statusLabel,
        startDate: e.startDate,
        endDate: e.endDate,
        profileImageUrl: e.avatarUrl,
        currentSalaryMinor:
          canSeeSalary && safe.activeSalary ? toMinor(Number(safe.activeSalary.amount)) : null,
        salaryCurrency: canSeeSalary ? (safe.activeSalary?.currency ?? null) : null,
        pendingLeaveCount: e.pendingLeaveCount,
        approvedLeaveCount: (e.leaveRequests ?? []).filter((l) => l.status === "APPROVED").length,
        overduePaymentMinor: toMinor(
          (e.payments ?? [])
            .filter((p) => p.status === "OVERDUE")
            .reduce((sum, p) => sum + Number(p.amount), 0)
        ),
        lastPaymentAt:
          (e.payments ?? [])
            .filter((p) => p.paidAt)
            .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())[0]
            ?.paidAt ?? null,
        isActive: e.status === "ACTIVE",
        permissions,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      };
    }),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    summary: {
      totalEmployees: summary.totalCount,
      activeEmployees: summary.activeCount,
      inactiveEmployees: summary.totalCount - summary.activeCount,
      employeesOnLeave: summary.onLeaveCount,
      pendingLeaveRequests: summary.pendingLeaveCount,
      totalMonthlySalaryMinor: toMinor(summary.monthlyPayable),
      overdueEmployeePaymentMinor: 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Detay
// ─────────────────────────────────────────────────────────────────────────

export async function getMobileEmployeeDetail(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
}) {
  requireView(input.role, input.isOwner);
  const canSeeSalary = canViewSalary(input.role, input.isOwner);
  const permissions = mobileEmployeePermissions(input.role, input.isOwner);

  let detail;
  try {
    detail = await getEmployeeById({
      companyId: input.companyId,
      employeeId: input.employeeId,
      includeSensitive: false,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("EMPLOYEE_NOT_FOUND", error.message, error.status);
    }
    throw error;
  }

  const employee = stripSalaryIfNeeded(detail.employee, canSeeSalary);
  const leaves = detail.employee.leaveRequests ?? [];
  const payments = detail.employee.payments ?? [];

  const activeLeave = leaves.find(
    (l) =>
      l.status === "APPROVED" &&
      new Date(l.endAt) >= new Date() &&
      new Date(l.startAt) <= new Date()
  );

  const totalLeaveDays = leaves
    .filter((l) => l.status === "APPROVED")
    .reduce((sum, l) => sum + Number(l.totalDays ?? 0), 0);

  const totalPaymentMinor = toMinor(payments.reduce((sum, p) => sum + Number(p.amount), 0));
  const overduePaymentMinor = toMinor(
    payments.filter((p) => p.status === "OVERDUE").reduce((sum, p) => sum + Number(p.amount), 0)
  );

  // PayrollRunItem.employeeId doğrudan FK — companyId + employeeId ile tenant
  // scoped, salt-okunur son 5 bordro kalemi. Onay/ödeme/toplu çalıştırma
  // aksiyonu YOK (spec kapsam dışı).
  const payrollItems = await db.payrollRunItem.findMany({
    where: { companyId: input.companyId, employeeId: input.employeeId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      payrollRun: { select: { title: true, periodStart: true, periodEnd: true, paidAt: true } },
      employeePayment: { select: { paidAt: true } },
    },
  });

  return {
    id: employee.id,
    employeeCode: null as string | null,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: employee.fullName,
    phone: employee.phone,
    email: employee.email,
    position: employee.jobTitle,
    department: employee.departmentId
      ? { id: employee.departmentId, name: employee.department }
      : null,
    employmentStatus: employee.status,
    employmentStatusLabel: employee.statusLabel,
    startDate: employee.startDate,
    endDate: employee.endDate,
    address: employee.address,
    notes: employee.notes,
    profileImageUrl: employee.avatarUrl,
    salary:
      canSeeSalary && employee.activeSalary
        ? {
            currentSalaryMinor: toMinor(Number(employee.activeSalary.amount)),
            currency: employee.activeSalary.currency,
            effectiveFrom: employee.activeSalary.effectiveFrom,
            paymentDay: employee.activeSalary.paymentDay,
          }
        : null,
    stats: {
      totalLeaveDays,
      pendingLeaveCount: employee.pendingLeaveCount,
      approvedLeaveCount: leaves.filter((l) => l.status === "APPROVED").length,
      totalPaymentMinor,
      overduePaymentMinor,
      performanceRecordCount: detail.performance.manualRecords?.length ?? 0,
      lastPerformanceAt: detail.performance.manualRecords?.[0]?.periodEnd ?? null,
    },
    currentLeave: activeLeave
      ? {
          id: activeLeave.id,
          type: activeLeave.type,
          typeLabel: leaveTypeLabel(activeLeave.type),
          startDate: activeLeave.startAt,
          endDate: activeLeave.endAt,
          totalDays: activeLeave.totalDays,
          status: activeLeave.status,
        }
      : null,
    recentLeaves: leaves.slice(0, 5).map(serializeLeaveForMobile),
    recentPayments: payments.slice(0, 5).map((p) => serializePaymentForMobile(p)),
    recentPerformanceRecords: (detail.performance.manualRecords ?? []).slice(0, 5).map(serializePerformanceForMobile),
    recentPayrollItems: payrollItems.map((item) => ({
      id: item.id,
      payrollRunId: item.payrollRunId,
      period: periodLabel(item.payrollRun.periodStart, item.payrollRun.periodEnd),
      status: item.status,
      baseSalaryMinor: toMinor(Number(item.baseSalary)),
      bonusMinor: toMinor(Number(item.bonusAmount)),
      deductionMinor: toMinor(Number(item.deductionAmount)),
      advanceMinor: toMinor(Number(item.advanceDeduction)),
      netPayableMinor: toMinor(Number(item.netPayable)),
      paidAt:
        (item.employeePayment?.paidAt ?? item.payrollRun.paidAt)?.toISOString() ?? null,
    })),
    calendarEvents: [] as unknown[], // Mobil calendar route'u mevcut değil — bkz. rapor
    linkedUser: employee.linkedUser
      ? { id: employee.linkedUser.userId, name: employee.linkedUser.name, email: employee.linkedUser.email }
      : null,
    permissions,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}

function serializeLeaveForMobile(l: {
  id: string;
  type: string;
  startAt: string | Date;
  endAt: string | Date;
  totalDays: unknown;
  status: string;
  statusLabel?: string;
  reason: string | null;
}) {
  return {
    id: l.id,
    type: l.type,
    typeLabel: leaveTypeLabel(l.type),
    startDate: l.startAt instanceof Date ? l.startAt.toISOString() : l.startAt,
    endDate: l.endAt instanceof Date ? l.endAt.toISOString() : l.endAt,
    totalDays: l.totalDays != null ? Number(l.totalDays) : null,
    status: l.status,
    statusLabel: l.statusLabel ?? l.status,
    reason: l.reason,
  };
}

function serializePaymentForMobile(p: {
  id: string;
  type: string;
  typeLabel?: string;
  amount: unknown;
  currency: string;
  status: string;
  statusLabel?: string;
  dueDate: string | Date | null;
  paidAt: string | Date | null;
  description: string | null;
}) {
  return {
    id: p.id,
    type: p.type,
    typeLabel: p.typeLabel ?? p.type,
    amountMinor: toMinor(Number(p.amount)),
    currency: p.currency,
    status: p.status,
    statusLabel: p.statusLabel ?? p.status,
    paymentDate: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
    dueDate: p.dueDate instanceof Date ? p.dueDate.toISOString() : p.dueDate,
    description: p.description,
  };
}

function serializePerformanceForMobile(r: {
  id: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  salesCount: number;
  salesTotal: unknown;
  taskScore: unknown;
  note: string | null;
}) {
  return {
    id: r.id,
    periodStart: r.periodStart instanceof Date ? r.periodStart.toISOString() : r.periodStart,
    periodEnd: r.periodEnd instanceof Date ? r.periodEnd.toISOString() : r.periodEnd,
    salesCount: r.salesCount,
    salesTotalMinor: toMinor(Number(r.salesTotal ?? 0)),
    taskScore: r.taskScore != null ? Number(r.taskScore) : null,
    note: r.note,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Oluşturma / düzenleme — canonical createEmployee/updateEmployee reuse
// ─────────────────────────────────────────────────────────────────────────

export const mobileEmployeeFormSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  position: z.string().trim().optional(),
  departmentId: z.string().trim().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employmentStatus: z.enum(["ACTIVE", "PASSIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  baseSalaryMinor: z.number().int().nonnegative().optional(),
  salaryCurrency: z.string().trim().optional(),
  paymentDay: z.number().int().min(1).max(31).optional(),
});

export async function createMobileEmployee(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  requireManage(input.role, input.isOwner);
  const parsed = mobileEmployeeFormSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }
  if (!parsed.data.firstName?.trim() && !parsed.data.lastName?.trim()) {
    throw new MobileFinanceError("VALIDATION_ERROR", "Ad veya soyad zorunludur.", 400);
  }

  try {
    const employee = await createEmployee({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        jobTitle: parsed.data.position,
        departmentId: parsed.data.departmentId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.employmentStatus,
        address: parsed.data.address,
        notes: parsed.data.notes,
        // companyUserId bilinçli olarak GÖNDERİLMİYOR — mobil çalışan oluşturma
        // otomatik kullanıcı hesabı/davet oluşturmamalı (spec kuralı).
        salary:
          parsed.data.baseSalaryMinor != null
            ? {
                amount: parsed.data.baseSalaryMinor / 100,
                currency: parsed.data.salaryCurrency ?? "TRY",
                paymentDay: parsed.data.paymentDay ?? null,
              }
            : undefined,
      },
    });
    return { id: employee.id, fullName: employee.fullName };
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("EMPLOYEE_CREATE_FAILED", error.message, error.status);
    }
    throw error;
  }
}

export async function updateMobileEmployee(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  body: unknown;
}) {
  requireManage(input.role, input.isOwner);
  const parsed = mobileEmployeeFormSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  // updateEmployee, data.companyUserId geçilmezse normalizeEmployeeInput onu
  // null'a çevirip mevcut kullanıcı bağlantısını KOPARIR. Mobil formda bu alan
  // yok — mevcut bağlantıyı korumak için açıkça geri geçiyoruz.
  const existing = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
    select: { companyUserId: true },
  });
  if (!existing) {
    throw new MobileFinanceError("EMPLOYEE_NOT_FOUND", "Çalışan bulunamadı.", 404);
  }

  try {
    const employee = await updateEmployee({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email,
        jobTitle: parsed.data.position,
        departmentId: parsed.data.departmentId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.employmentStatus,
        address: parsed.data.address,
        notes: parsed.data.notes,
        companyUserId: existing.companyUserId,
      },
    });
    return { id: employee.id, fullName: employee.fullName };
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("EMPLOYEE_UPDATE_FAILED", error.message, error.status);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// İzinler
// ─────────────────────────────────────────────────────────────────────────

export type MobileLeavesFilters = {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listMobileEmployeeLeaves(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  filters: MobileLeavesFilters;
}) {
  requireView(input.role, input.isOwner);
  const canManage = hasEmployeeApiPermission(input.role as UserRole, "manageRecords", input.isOwner);

  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
    select: { id: true },
  });
  if (!employee) {
    throw new MobileFinanceError("EMPLOYEE_NOT_FOUND", "Çalışan bulunamadı.", 404);
  }

  const { filters } = input;
  const rows = await db.employeeLeave.findMany({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            startAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { startAt: "desc" },
  });

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? SUB_PAGE_SIZE));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    items: pageRows.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      type: l.type,
      typeLabel: l.type,
      startDate: l.startAt.toISOString(),
      endDate: l.endAt.toISOString(),
      totalDays: l.totalDays != null ? Number(l.totalDays) : null,
      status: l.status,
      statusLabel: l.status,
      reason: l.reason,
      managerNote: null as string | null,
      requestedAt: l.createdAt.toISOString(),
      approvedAt: l.approvedAt?.toISOString() ?? null,
      rejectedAt: l.status === "REJECTED" ? l.updatedAt.toISOString() : null,
      canApprove: canManage && l.status === "PENDING",
      canReject: canManage && l.status === "PENDING",
      canCancel: canManage && (l.status === "PENDING" || l.status === "APPROVED"),
    })),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export const mobileLeaveCreateSchema = z.object({
  type: z.enum(["ANNUAL", "SICK", "UNPAID", "EXCUSE", "REMOTE", "OTHER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
});

export async function createMobileEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  body: unknown;
}) {
  requireManage(input.role, input.isOwner);
  const parsed = mobileLeaveCreateSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const startAt = new Date(parsed.data.startDate);
  const endAt = new Date(parsed.data.endDate);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new MobileFinanceError("VALIDATION_ERROR", "Geçerli bir tarih girin.", 400);
  }

  try {
    // status BİLİNÇLİ OLARAK geçilmiyor — canonical servis varsayılan PENDING
    // uyguluyor, istemciden onay durumu kabul edilmiyor.
    const leave = await createEmployeeLeave({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      type: parsed.data.type,
      startAt,
      endAt,
      reason: parsed.data.reason,
    });
    return leave;
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("LEAVE_CREATE_FAILED", error.message, error.status);
    }
    throw error;
  }
}

/** leaveId → tenant-scoped leave kaydı. Route şekli spec'e göre yalnız
 * leaveId taşıyor (/api/mobile/leaves/[id]/approve) — employeeId burada
 * kayıttan çözülüyor, IDOR koruması companyId scope ile sağlanıyor. */
async function getLeaveOrThrow(companyId: string, leaveId: string) {
  const leave = await db.employeeLeave.findFirst({
    where: { id: leaveId, companyId },
  });
  if (!leave) {
    throw new MobileFinanceError("LEAVE_NOT_FOUND", "İzin kaydı bulunamadı.", 404);
  }
  return leave;
}

export async function approveMobileEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  leaveId: string;
}) {
  requireManage(input.role, input.isOwner);
  const leave = await getLeaveOrThrow(input.companyId, input.leaveId);
  // canonical approveEmployeeLeave durum geçişini kontrol etmiyor — bilinçli
  // olarak burada ekliyoruz: yalnız PENDING → APPROVED.
  if (leave.status !== "PENDING") {
    throw new MobileFinanceError(
      "INVALID_LEAVE_TRANSITION",
      "Bu izin talebi zaten işlem görmüş.",
      409
    );
  }
  try {
    return await approveEmployeeLeave({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: leave.employeeId,
      leaveId: input.leaveId,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("LEAVE_APPROVE_FAILED", error.message, error.status);
    }
    throw error;
  }
}

export const mobileLeaveRejectSchema = z.object({
  reason: z.string().trim().min(1, "Red nedeni zorunludur.").max(1000),
});

export async function rejectMobileEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  leaveId: string;
  body: unknown;
}) {
  requireManage(input.role, input.isOwner);
  const parsed = mobileLeaveRejectSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError("VALIDATION_ERROR", "Red nedeni zorunludur.", 400);
  }
  const leave = await getLeaveOrThrow(input.companyId, input.leaveId);
  if (leave.status !== "PENDING") {
    throw new MobileFinanceError(
      "INVALID_LEAVE_TRANSITION",
      "Bu izin talebi zaten işlem görmüş.",
      409
    );
  }
  try {
    const result = await rejectEmployeeLeave({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: leave.employeeId,
      leaveId: input.leaveId,
    });
    // Reddetme nedeni canonical serializeLeave şemasında ayrı bir alan değil —
    // mevcut `reason` alanına ekleme yapılmadı (model manager-note tutmuyor),
    // yalnız audit log üzerinden mevcut davranış korunuyor.
    return result;
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("LEAVE_REJECT_FAILED", error.message, error.status);
    }
    throw error;
  }
}

export async function cancelMobileEmployeeLeave(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  leaveId: string;
}) {
  requireManage(input.role, input.isOwner);
  const leave = await getLeaveOrThrow(input.companyId, input.leaveId);
  // Canonical cancelEmployeeLeave (lib/employee-service.ts) reuse ediliyor —
  // web route'u da AYNI fonksiyonu kullanıyor artık; durum geçişi, geçmiş izin
  // kuralı, idempotent tekrar iptal ve activity/notification servis
  // katmanında merkezi.
  try {
    const result = await cancelEmployeeLeave({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: leave.employeeId,
      leaveId: input.leaveId,
    });
    return { id: result.id, status: result.status };
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("LEAVE_CANCEL_FAILED", error.message, error.status);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Ödemeler — canonical createEmployeePayment reuse + KALICI (DB-backed)
// idempotency. In-memory Map kaldırıldı: process restart, PM2 cluster/multi
// instance ve eşzamanlı çift request senaryolarında güvenli değildi — artık
// EmployeePaymentIdempotency modelinin @@unique([companyId, idempotencyKey])
// kısıtı tek güvenlik kaynağı (bkz. lib/mobile/employee-payment-idempotency.ts).
// ─────────────────────────────────────────────────────────────────────────

export type MobilePaymentsFilters = {
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export async function listMobileEmployeePayments(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  filters: MobilePaymentsFilters;
}) {
  requireView(input.role, input.isOwner);
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId },
    select: { id: true },
  });
  if (!employee) {
    throw new MobileFinanceError("EMPLOYEE_NOT_FOUND", "Çalışan bulunamadı.", 404);
  }

  const { filters } = input;
  const rows = await db.employeePayment.findMany({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { relatedAccount: { select: { id: true, name: true, type: true } } },
  });

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? SUB_PAGE_SIZE));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    items: pageRows.map((p) => ({
      id: p.id,
      type: p.type,
      typeLabel: p.type,
      amountMinor: toMinor(Number(p.amount)),
      currency: p.currency,
      status: p.status,
      statusLabel: p.status,
      paymentDate: p.paidAt?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      description: p.description,
      referenceNumber: null as string | null,
      account: p.relatedAccount
        ? { id: p.relatedAccount.id, name: p.relatedAccount.name, type: p.relatedAccount.type }
        : null,
      expenseId: p.relatedExpenseId,
      cashMovementId: p.relatedTransactionId,
      payrollRunId: null as string | null,
      createdAt: p.createdAt.toISOString(),
      canOpenReference: Boolean(p.relatedExpenseId),
    })),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

export const mobilePaymentCreateSchema = z.object({
  type: z.enum(["SALARY", "ADVANCE", "BONUS", "DEDUCTION", "EXPENSE_REIMBURSEMENT", "OTHER"]),
  amountMinor: z.number().int().positive(),
  accountId: z.string().min(1, "Hesap seçilmelidir."),
  paymentDate: z.string().optional(),
  dueDate: z.string().optional(),
  description: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid("Geçerli idempotency anahtarı gerekir."),
});

export async function createMobileEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  body: unknown;
}) {
  const perms = getEmployeeModulePermissions(input.role as UserRole, input.isOwner);
  if (!perms.canProcessPayments) {
    throw new MobileFinanceError("FORBIDDEN", "Çalışan ödemesi yapma yetkiniz yok.", 403);
  }

  const parsed = mobilePaymentCreateSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const account = await db.account.findFirst({
    where: { id: parsed.data.accountId, companyId: input.companyId },
  });
  if (!account) {
    throw new MobileFinanceError("FINANCE_ACCOUNT_NOT_FOUND", "Ödeme hesabı bulunamadı.", 404);
  }

  const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined;

  const outcome = await executeIdempotentEmployeePayment({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    employeeId: input.employeeId,
    idempotencyKey: parsed.data.idempotencyKey,
    payment: {
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      employeeId: input.employeeId,
      type: parsed.data.type,
      amount: parsed.data.amountMinor / 100,
      relatedAccountId: parsed.data.accountId,
      dueDate,
      description: parsed.data.description,
    },
    serialize: (payment) => serializePaymentForMobile(payment as never),
  });

  if (outcome.status === "PROCESSING") {
    throw new MobileFinanceError(
      "EMPLOYEE_PAYMENT_PROCESSING",
      "Ödeme işleniyor, lütfen kısa süre sonra tekrar deneyin.",
      409
    );
  }

  const refreshedAccount = await db.account.findUnique({ where: { id: account.id } });

  return {
    replay: outcome.replayed,
    payment: outcome.result,
    accountBalanceMinor: refreshedAccount ? toMinor(Number(refreshedAccount.balance)) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Performans — SALT OKUNUR. Bu şemada EmployeePerformanceRecord otomatik
// (cron ile) üretilen bir satış/aktivite özetidir — title/kategori/skor/
// güçlü-yön/gelişim-alanı gibi manuel alanlar İÇERMEZ. Web tarafında da bu
// veriye yalnız GET ile erişiliyor (app/api/employees/[id]/performance yalnız
// GET destekliyor). Bu yüzden mobilde de "performans kaydı oluşturma" (POST)
// EKLENMEDİ — eklemek "yeni paralel İK mantığı icat etme" kısıtını ihlal
// ederdi. bkz. final rapor.
// ─────────────────────────────────────────────────────────────────────────

export async function listMobileEmployeePerformance(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  employeeId: string;
  filters: { dateFrom?: string; dateTo?: string; page?: number; pageSize?: number };
}) {
  requireView(input.role, input.isOwner);

  const performance = await getEmployeePerformance({
    companyId: input.companyId,
    employeeId: input.employeeId,
    from: input.filters.dateFrom ?? null,
    to: input.filters.dateTo ?? null,
  });

  const records = performance.manualRecords ?? [];
  const page = Math.max(1, input.filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.filters.pageSize ?? SUB_PAGE_SIZE));
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = records.slice(start, start + pageSize);

  return {
    items: pageRows.map(serializePerformanceForMobile),
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Departmanlar
// ─────────────────────────────────────────────────────────────────────────

export async function listMobileDepartments(input: { companyId: string; role: string; isOwner: boolean }) {
  requireView(input.role, input.isOwner);
  const departments = await listEmployeeDepartments({ companyId: input.companyId });
  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    employeeCount: d.employeeCount,
    activeEmployeeCount: d.employeeCount,
  }));
}
