import { NextResponse } from "next/server";
import { approvePayrollRun, PayrollServiceError } from "@/lib/payroll-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const payrollRun = await approvePayrollRun({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      payrollRunId: id,
    });

    return NextResponse.json({ success: true, payrollRun });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_APPROVE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro onaylanırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
