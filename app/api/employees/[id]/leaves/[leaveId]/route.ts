import { NextResponse } from "next/server";
import {
  approveEmployeeLeave,
  cancelEmployeeLeave,
  EmployeeServiceError,
  rejectEmployeeLeave,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = {
  params: Promise<{ id: string; leaveId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id, leaveId } = await context.params;
    const body = await req.json();

    let leave;
    if (body.action === "approve") {
      leave = await approveEmployeeLeave({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        employeeId: id,
        leaveId,
      });
    } else if (body.action === "reject") {
      leave = await rejectEmployeeLeave({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        employeeId: id,
        leaveId,
      });
    } else if (body.action === "cancel") {
      leave = await cancelEmployeeLeave({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        employeeId: id,
        leaveId,
      });
    } else {
      return NextResponse.json(
        { success: false, message: "Geçersiz işlem." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, leave });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_LEAVE_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "İzin güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
