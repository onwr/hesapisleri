import { NextResponse } from "next/server";
import { previewPayrollRun, PayrollServiceError } from "@/lib/payroll-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

export async function POST(req: Request) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const preview = await previewPayrollRun({
      companyId: auth.companyId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });

    return NextResponse.json({ success: true, preview });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_PREVIEW_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro önizlemesi alınamadı." },
      { status: 500 }
    );
  }
}
