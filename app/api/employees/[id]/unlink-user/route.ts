import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  unlinkEmployeeFromCompanyUser,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const employee = await unlinkEmployeeFromCompanyUser({
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

    console.error("EMPLOYEE_UNLINK_USER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap bağlantısı kaldırılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
