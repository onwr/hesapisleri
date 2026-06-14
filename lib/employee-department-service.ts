import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import {
  normalizeDepartmentName,
  serializeEmployeeDepartment,
  validateDepartmentName,
} from "@/lib/employee-department-utils";

export class EmployeeDepartmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EmployeeDepartmentError";
    this.status = status;
  }
}

const departmentInclude = {
  managerEmployee: {
    select: { id: true, firstName: true, lastName: true },
  },
  _count: { select: { employees: true } },
} satisfies Prisma.EmployeeDepartmentInclude;

async function getDepartmentInCompany(departmentId: string, companyId: string) {
  const department = await db.employeeDepartment.findFirst({
    where: { id: departmentId, companyId },
    include: departmentInclude,
  });

  if (!department) {
    throw new EmployeeDepartmentError("Departman bulunamadı.", 404);
  }

  return department;
}

async function assertManagerInCompany(
  managerEmployeeId: string | null | undefined,
  companyId: string
) {
  if (!managerEmployeeId) return;

  const employee = await db.employee.findFirst({
    where: { id: managerEmployeeId, companyId },
    select: { id: true },
  });

  if (!employee) {
    throw new EmployeeDepartmentError("Yönetici çalışan bu firmada bulunamadı.", 404);
  }
}

async function assertUniqueDepartmentName(
  companyId: string,
  name: string,
  excludeId?: string
) {
  const existing = await db.employeeDepartment.findFirst({
    where: {
      companyId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });

  if (existing) {
    throw new EmployeeDepartmentError("Bu departman adı zaten kullanılıyor.", 409);
  }
}

async function logDepartmentActivity(input: {
  companyId: string;
  userId: string;
  message: string;
  action?: string;
}) {
  await db.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action ?? "UPDATE",
      module: "employees",
      message: input.message,
    },
  });
}

export async function syncLegacyEmployeeDepartments(companyId: string) {
  const employees = await db.employee.findMany({
    where: {
      companyId,
      departmentId: null,
      department: { not: null },
    },
    select: { id: true, department: true },
  });

  const uniqueNames = [
    ...new Set(
      employees
        .map((e) => e.department?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ];

  if (uniqueNames.length === 0) return;

  for (const rawName of uniqueNames) {
    const name = normalizeDepartmentName(rawName);
    const department =
      (await db.employeeDepartment.findFirst({
        where: { companyId, name: { equals: name, mode: "insensitive" } },
      })) ??
      (await db.employeeDepartment.create({
        data: { companyId, name, isActive: true },
      }));

    await db.employee.updateMany({
      where: {
        companyId,
        departmentId: null,
        department: { equals: rawName, mode: "insensitive" },
      },
      data: { departmentId: department.id, department: name },
    });
  }
}

export async function listEmployeeDepartments(input: {
  companyId: string;
  includeInactive?: boolean;
  syncLegacy?: boolean;
}) {
  if (input.syncLegacy !== false) {
    await syncLegacyEmployeeDepartments(input.companyId);
  }

  const rows = await db.employeeDepartment.findMany({
    where: {
      companyId: input.companyId,
      ...(input.includeInactive ? {} : { isActive: true }),
    },
    include: departmentInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return rows.map((row) =>
    serializeEmployeeDepartment(row, row._count.employees)
  );
}

export async function getEmployeeDepartmentStats(companyId: string) {
  await syncLegacyEmployeeDepartments(companyId);

  const [departments, unassignedCount] = await Promise.all([
    db.employeeDepartment.findMany({
      where: { companyId },
      include: { _count: { select: { employees: true } } },
    }),
    db.employee.count({
      where: {
        companyId,
        departmentId: null,
        OR: [{ department: null }, { department: "" }],
      },
    }),
  ]);

  const activeCount = departments.filter((d) => d.isActive).length;
  const passiveCount = departments.filter((d) => !d.isActive).length;
  const busiest = [...departments].sort(
    (a, b) => b._count.employees - a._count.employees
  )[0];

  return {
    activeCount,
    passiveCount,
    unassignedEmployeeCount: unassignedCount,
    busiestDepartment: busiest
      ? { name: busiest.name, employeeCount: busiest._count.employees }
      : null,
  };
}

export async function createEmployeeDepartment(input: {
  companyId: string;
  actorUserId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  managerEmployeeId?: string | null;
}) {
  const validation = validateDepartmentName(input.name);
  if (!validation.ok) {
    throw new EmployeeDepartmentError(validation.message);
  }

  await assertUniqueDepartmentName(input.companyId, validation.value);
  await assertManagerInCompany(input.managerEmployeeId, input.companyId);

  const created = await db.employeeDepartment.create({
    data: {
      companyId: input.companyId,
      name: validation.value,
      description: input.description?.trim() || null,
      color: input.color?.trim() || null,
      managerEmployeeId: input.managerEmployeeId || null,
      isActive: true,
    },
    include: departmentInclude,
  });

  await logDepartmentActivity({
    companyId: input.companyId,
    userId: input.actorUserId,
    action: "CREATE",
    message: `${validation.value} departmanı oluşturuldu.`,
  });

  return serializeEmployeeDepartment(created, created._count.employees);
}

export async function updateEmployeeDepartment(input: {
  companyId: string;
  actorUserId: string;
  departmentId: string;
  name?: string;
  description?: string | null;
  color?: string | null;
  managerEmployeeId?: string | null;
  isActive?: boolean;
}) {
  const existing = await getDepartmentInCompany(input.departmentId, input.companyId);

  let nextName = existing.name;
  if (input.name != null) {
    const validation = validateDepartmentName(input.name);
    if (!validation.ok) {
      throw new EmployeeDepartmentError(validation.message);
    }
    nextName = validation.value;
    await assertUniqueDepartmentName(input.companyId, nextName, input.departmentId);
  }

  if (input.managerEmployeeId !== undefined) {
    await assertManagerInCompany(input.managerEmployeeId, input.companyId);
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.employeeDepartment.update({
      where: { id: input.departmentId },
      data: {
        ...(input.name != null ? { name: nextName } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.color !== undefined ? { color: input.color?.trim() || null } : {}),
        ...(input.managerEmployeeId !== undefined
          ? { managerEmployeeId: input.managerEmployeeId || null }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: departmentInclude,
    });

    if (input.name != null && nextName !== existing.name) {
      await tx.employee.updateMany({
        where: { companyId: input.companyId, departmentId: input.departmentId },
        data: { department: nextName },
      });
    }

    return row;
  });

  await logDepartmentActivity({
    companyId: input.companyId,
    userId: input.actorUserId,
    message: `${updated.name} departmanı güncellendi.`,
  });

  return serializeEmployeeDepartment(updated, updated._count.employees);
}

export async function deactivateEmployeeDepartment(input: {
  companyId: string;
  actorUserId: string;
  departmentId: string;
}) {
  return updateEmployeeDepartment({
    ...input,
    isActive: false,
  });
}

export async function resolveEmployeeDepartmentAssignment(input: {
  companyId: string;
  departmentId?: string | null;
}) {
  if (input.departmentId === undefined) {
    return undefined;
  }

  if (!input.departmentId) {
    return { departmentId: null as string | null, department: null as string | null };
  }

  const department = await db.employeeDepartment.findFirst({
    where: { id: input.departmentId, companyId: input.companyId, isActive: true },
  });

  if (!department) {
    throw new EmployeeDepartmentError("Seçilen departman bulunamadı veya pasif.", 404);
  }

  return { departmentId: department.id, department: department.name };
}
