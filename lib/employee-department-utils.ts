import type { Employee, EmployeeDepartment } from "@prisma/client";

export function resolveEmployeeDepartmentName(input: {
  department?: string | null;
  departmentRef?: Pick<EmployeeDepartment, "name"> | null;
}) {
  return input.departmentRef?.name ?? input.department?.trim() ?? null;
}

export function resolveEmployeeDepartmentLabel(input: {
  department?: string | null;
  departmentRef?: Pick<EmployeeDepartment, "name" | "color"> | null;
}) {
  const name = resolveEmployeeDepartmentName(input);
  if (!name) return null;
  return {
    name,
    color: input.departmentRef?.color ?? null,
    isLegacy: !input.departmentRef && Boolean(input.department?.trim()),
  };
}

export function normalizeDepartmentName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateDepartmentName(name: string) {
  const normalized = normalizeDepartmentName(name);
  if (normalized.length < 2) {
    return { ok: false as const, message: "Departman adı en az 2 karakter olmalıdır." };
  }
  if (normalized.length > 80) {
    return { ok: false as const, message: "Departman adı en fazla 80 karakter olabilir." };
  }
  return { ok: true as const, value: normalized };
}

export type SerializedEmployeeDepartment = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  employeeCount: number;
  managerEmployee: {
    id: string;
    fullName: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeEmployeeDepartment(
  row: EmployeeDepartment & {
    employees?: Array<{ id: string }>;
    managerEmployee?: Pick<Employee, "id" | "firstName" | "lastName"> | null;
  },
  employeeCount?: number
): SerializedEmployeeDepartment {
  const count =
    employeeCount ??
    row.employees?.length ??
    0;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isActive: row.isActive,
    employeeCount: count,
    managerEmployee: row.managerEmployee
      ? {
          id: row.managerEmployee.id,
          fullName: `${row.managerEmployee.firstName} ${row.managerEmployee.lastName}`.trim(),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
