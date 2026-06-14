import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { formatEmployeeDisplayName } from "@/lib/employee-utils";
import { canAccessModule } from "@/lib/permission-utils";
import { db } from "@/lib/prisma";

export async function requirePersonnelPerformanceAccess() {
  const session = await getAppSession();

  const canView = canAccessModule(
    session.effectiveRole,
    "employees",
    session.companyUser.isOwner
  );

  if (!canView) {
    notFound();
  }

  return session;
}

export async function getPersonnelPerformanceFilterOptions(companyId: string) {
  const [employeeRows, departmentRows] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.employee.findMany({
      where: {
        companyId,
        department: { not: null },
      },
      select: { department: true },
      distinct: ["department"],
      orderBy: { department: "asc" },
    }),
  ]);

  return {
    departments: departmentRows
      .map((row) => row.department)
      .filter((value): value is string => Boolean(value)),
    employees: employeeRows.map((employee) => ({
      id: employee.id,
      name: formatEmployeeDisplayName(employee),
    })),
  };
}
