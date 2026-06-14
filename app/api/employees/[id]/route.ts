import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  deleteEmployeeRecord,
  getEmployeeById,
  updateEmployee,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const data = await getEmployeeById({
      companyId: auth.companyId,
      employeeId: id,
      includeSensitive: true,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışan yüklenirken bir hata oluştu." },
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

    const employee = await updateEmployee({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      data: body,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışan güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const employee = await deleteEmployeeRecord({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışan kaydı silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
