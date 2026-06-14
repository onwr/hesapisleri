import { NextResponse } from "next/server";
import {
  deactivateEmployeeDepartment,
  EmployeeDepartmentError,
  listEmployeeDepartments,
  updateEmployeeDepartment,
} from "@/lib/employee-department-service";
import { requireApiEmployeesPermission } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const departments = await listEmployeeDepartments({
      companyId: auth.companyId,
      includeInactive: true,
    });
    const department = departments.find((row) => row.id === id);

    if (!department) {
      return NextResponse.json(
        { success: false, message: "Departman bulunamadı." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, department });
  } catch (error) {
    if (error instanceof EmployeeDepartmentError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DEPARTMENT_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Departman yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const department = await updateEmployeeDepartment({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      departmentId: id,
      name: body.name,
      description: body.description,
      color: body.color,
      managerEmployeeId: body.managerEmployeeId,
      isActive: body.isActive,
    });

    return NextResponse.json({ success: true, department });
  } catch (error) {
    if (error instanceof EmployeeDepartmentError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DEPARTMENT_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Departman güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    await deactivateEmployeeDepartment({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      departmentId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof EmployeeDepartmentError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DEPARTMENT_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Departman pasifleştirilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
