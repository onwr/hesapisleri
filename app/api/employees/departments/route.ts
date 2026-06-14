import { NextResponse } from "next/server";
import {
  createEmployeeDepartment,
  getEmployeeDepartmentStats,
  listEmployeeDepartments,
  EmployeeDepartmentError,
} from "@/lib/employee-department-service";
import { requireApiEmployeesPermission } from "@/lib/module-access";

export async function GET(req: Request) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const withStats = url.searchParams.get("stats") === "true";

    const departments = await listEmployeeDepartments({
      companyId: auth.companyId,
      includeInactive,
    });

    if (!withStats) {
      return NextResponse.json({ success: true, departments });
    }

    const stats = await getEmployeeDepartmentStats(auth.companyId);
    return NextResponse.json({ success: true, departments, stats });
  } catch (error) {
    if (error instanceof EmployeeDepartmentError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DEPARTMENTS_LIST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Departmanlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, message: "Departman adı zorunludur." },
        { status: 400 }
      );
    }

    const department = await createEmployeeDepartment({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      name: body.name,
      description: body.description,
      color: body.color,
      managerEmployeeId: body.managerEmployeeId,
    });

    return NextResponse.json({ success: true, department });
  } catch (error) {
    if (error instanceof EmployeeDepartmentError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DEPARTMENT_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Departman oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
