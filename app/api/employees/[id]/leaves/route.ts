import { NextResponse } from "next/server";
import {
  createEmployeeLeave,
  EmployeeServiceError,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const leave = await createEmployeeLeave({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      type: body.type,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      reason: body.reason,
      status: body.status,
    });

    return NextResponse.json({ success: true, leave });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_LEAVE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "İzin kaydı oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
