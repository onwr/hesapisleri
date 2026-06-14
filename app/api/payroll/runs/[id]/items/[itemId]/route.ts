import { NextResponse } from "next/server";
import {
  PayrollServiceError,
  updatePayrollRunItem,
} from "@/lib/payroll-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const { id, itemId } = await context.params;
    const body = await req.json();

    const result = await updatePayrollRunItem({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      payrollRunId: id,
      itemId,
      bonusAmount:
        body.bonusAmount !== undefined ? Number(body.bonusAmount) : undefined,
      deductionAmount:
        body.deductionAmount !== undefined
          ? Number(body.deductionAmount)
          : undefined,
      advanceDeduction:
        body.advanceDeduction !== undefined
          ? Number(body.advanceDeduction)
          : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    });

    return NextResponse.json({
      success: true,
      item: result.item,
      payrollRun: result.payrollRun,
      warning: result.warning,
    });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_ITEM_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro kalemi güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
