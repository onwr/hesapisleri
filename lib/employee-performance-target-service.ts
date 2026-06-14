import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import { endOfDay, startOfDay } from "@/lib/calendar-utils";
import {
  pickEffectiveTarget,
  type EffectivePerformanceTarget,
} from "@/lib/employee-performance-target-utils";

export class PerformanceTargetServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PerformanceTargetServiceError";
    this.status = status;
  }
}

function serializeTarget(
  target: Prisma.EmployeePerformanceTargetGetPayload<object>
): EffectivePerformanceTarget {
  const scope: EffectivePerformanceTarget["scope"] = target.employeeId
    ? "employee"
    : target.department
      ? "department"
      : "company";

  return {
    id: target.id,
    scope,
    employeeId: target.employeeId,
    department: target.department,
    periodStart: target.periodStart.toISOString(),
    periodEnd: target.periodEnd.toISOString(),
    salesCountTarget: target.salesCountTarget,
    revenueTarget: target.revenueTarget ? Number(target.revenueTarget) : null,
    collectionTarget: target.collectionTarget
      ? Number(target.collectionTarget)
      : null,
    maxLeaveDays: target.maxLeaveDays,
    payrollEfficiencyTarget: target.payrollEfficiencyTarget
      ? Number(target.payrollEfficiencyTarget)
      : null,
    scoreTarget: target.scoreTarget ? Number(target.scoreTarget) : null,
    notes: target.notes,
  };
}

function normalizeTargetPeriod(input: {
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  const periodStart = startOfDay(new Date(input.periodStart));
  const periodEnd = endOfDay(new Date(input.periodEnd));

  if (periodStart.getTime() > periodEnd.getTime()) {
    throw new PerformanceTargetServiceError(
      "Hedef dönemi geçersiz. Başlangıç bitişten sonra olamaz."
    );
  }

  return { periodStart, periodEnd };
}

async function assertNoDuplicateTarget(input: {
  companyId: string;
  employeeId?: string | null;
  department?: string | null;
  periodStart: Date;
  periodEnd: Date;
  excludeId?: string;
}) {
  const existing = await db.employeePerformanceTarget.findFirst({
    where: {
      companyId: input.companyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
      ...(input.employeeId
        ? { employeeId: input.employeeId }
        : input.department
          ? { employeeId: null, department: input.department }
          : { employeeId: null, department: null }),
    },
  });

  if (existing) {
    throw new PerformanceTargetServiceError(
      "Bu kapsam ve dönem için zaten hedef tanımlı.",
      409
    );
  }
}

export async function createPerformanceTarget(input: {
  companyId: string;
  actorUserId: string;
  employeeId?: string | null;
  department?: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  salesCountTarget?: number | null;
  revenueTarget?: number | null;
  collectionTarget?: number | null;
  maxLeaveDays?: number | null;
  payrollEfficiencyTarget?: number | null;
  scoreTarget?: number | null;
  notes?: string | null;
}) {
  const { periodStart, periodEnd } = normalizeTargetPeriod(input);

  if (input.employeeId && input.department) {
    throw new PerformanceTargetServiceError(
      "Çalışan ve departman hedefi aynı anda seçilemez."
    );
  }

  if (input.employeeId) {
    const employee = await db.employee.findFirst({
      where: { id: input.employeeId, companyId: input.companyId },
    });
    if (!employee) {
      throw new PerformanceTargetServiceError("Çalışan bulunamadı.", 404);
    }
  }

  await assertNoDuplicateTarget({
    companyId: input.companyId,
    employeeId: input.employeeId,
    department: input.department?.trim() || null,
    periodStart,
    periodEnd,
  });

  const created = await db.employeePerformanceTarget.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId ?? null,
      department: input.department?.trim() || null,
      periodStart,
      periodEnd,
      salesCountTarget: input.salesCountTarget ?? null,
      revenueTarget: input.revenueTarget ?? null,
      collectionTarget: input.collectionTarget ?? null,
      maxLeaveDays: input.maxLeaveDays ?? null,
      payrollEfficiencyTarget: input.payrollEfficiencyTarget ?? null,
      scoreTarget: input.scoreTarget ?? null,
      notes: input.notes?.trim() || null,
      createdByUserId: input.actorUserId,
    },
  });

  return serializeTarget(created);
}

export async function updatePerformanceTarget(input: {
  companyId: string;
  targetId: string;
  salesCountTarget?: number | null;
  revenueTarget?: number | null;
  collectionTarget?: number | null;
  maxLeaveDays?: number | null;
  payrollEfficiencyTarget?: number | null;
  scoreTarget?: number | null;
  notes?: string | null;
}) {
  const existing = await db.employeePerformanceTarget.findFirst({
    where: { id: input.targetId, companyId: input.companyId },
  });

  if (!existing) {
    throw new PerformanceTargetServiceError("Hedef bulunamadı.", 404);
  }

  const updated = await db.employeePerformanceTarget.update({
    where: { id: existing.id },
    data: {
      ...(input.salesCountTarget !== undefined
        ? { salesCountTarget: input.salesCountTarget }
        : {}),
      ...(input.revenueTarget !== undefined
        ? { revenueTarget: input.revenueTarget }
        : {}),
      ...(input.collectionTarget !== undefined
        ? { collectionTarget: input.collectionTarget }
        : {}),
      ...(input.maxLeaveDays !== undefined
        ? { maxLeaveDays: input.maxLeaveDays }
        : {}),
      ...(input.payrollEfficiencyTarget !== undefined
        ? { payrollEfficiencyTarget: input.payrollEfficiencyTarget }
        : {}),
      ...(input.scoreTarget !== undefined ? { scoreTarget: input.scoreTarget } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });

  return serializeTarget(updated);
}

export async function deletePerformanceTarget(input: {
  companyId: string;
  targetId: string;
}) {
  const existing = await db.employeePerformanceTarget.findFirst({
    where: { id: input.targetId, companyId: input.companyId },
  });

  if (!existing) {
    throw new PerformanceTargetServiceError("Hedef bulunamadı.", 404);
  }

  await db.employeePerformanceTarget.delete({ where: { id: existing.id } });
  return { success: true };
}

export async function listPerformanceTargets(input: {
  companyId: string;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  employeeId?: string;
  department?: string;
  scope?: "employee" | "department" | "company";
}) {
  const where: Prisma.EmployeePerformanceTargetWhereInput = {
    companyId: input.companyId,
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.department ? { department: input.department } : {}),
    ...(input.scope === "employee"
      ? { employeeId: { not: null } }
      : input.scope === "department"
        ? { employeeId: null, department: { not: null } }
        : input.scope === "company"
          ? { employeeId: null, department: null }
          : {}),
  };

  if (input.periodStart && input.periodEnd) {
    const periodStart = startOfDay(new Date(input.periodStart));
    const periodEnd = endOfDay(new Date(input.periodEnd));
    where.periodStart = periodStart;
    where.periodEnd = periodEnd;
  }

  const targets = await db.employeePerformanceTarget.findMany({
    where,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });

  return targets.map((target) => ({
    ...serializeTarget(target),
    employeeName: target.employee
      ? formatEmployeeDisplayName(target.employee)
      : null,
    updatedAt: target.updatedAt.toISOString(),
    createdAt: target.createdAt.toISOString(),
  }));
}

export async function getPerformanceTargetById(input: {
  companyId: string;
  targetId: string;
}) {
  const target = await db.employeePerformanceTarget.findFirst({
    where: { id: input.targetId, companyId: input.companyId },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!target) {
    throw new PerformanceTargetServiceError("Hedef bulunamadı.", 404);
  }

  return {
    ...serializeTarget(target),
    employeeName: target.employee
      ? formatEmployeeDisplayName(target.employee)
      : null,
    updatedAt: target.updatedAt.toISOString(),
    createdAt: target.createdAt.toISOString(),
  };
}

export async function getEffectiveTargetForEmployee(input: {
  companyId: string;
  employeeId: string;
  department?: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  const periodStart = startOfDay(new Date(input.periodStart));
  const periodEnd = endOfDay(new Date(input.periodEnd));

  const targets = await db.employeePerformanceTarget.findMany({
    where: {
      companyId: input.companyId,
      periodStart,
      periodEnd,
      OR: [
        { employeeId: input.employeeId },
        ...(input.department ? [{ employeeId: null, department: input.department }] : []),
        { employeeId: null, department: null },
      ],
    },
  });

  return pickEffectiveTarget(
    targets.map(serializeTarget),
    {
      employeeId: input.employeeId,
      department: input.department ?? null,
    }
  );
}

export async function listEffectiveTargetsForPeriod(input: {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const targets = await db.employeePerformanceTarget.findMany({
    where: {
      companyId: input.companyId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  });

  return targets.map(serializeTarget);
}
