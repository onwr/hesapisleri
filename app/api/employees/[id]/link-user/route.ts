import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  linkEmployeeToCompanyUser,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    if (!body.companyUserId) {
      return NextResponse.json(
        { success: false, message: "companyUserId zorunludur." },
        { status: 400 }
      );
    }

    const employee = await linkEmployeeToCompanyUser({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      companyUserId: body.companyUserId,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_LINK_USER_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hesap bağlanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
