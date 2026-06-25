import { NextResponse } from "next/server";
import {
  markPayrollRunPaid,
  PayrollServiceError,
} from "@/lib/payroll-service";
import { validateMarkEmployeePaymentPaidInput } from "@/lib/employee-payment-finance-utils";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("processPayments");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const validation = validateMarkEmployeePaymentPaidInput({
      relatedAccountId: body.relatedAccountId,
      requireAccount: true,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: validation.status }
      );
    }

    const payrollRun = await markPayrollRunPaid({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      payrollRunId: id,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
      relatedAccountId: body.relatedAccountId,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, payrollRun });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_MARK_PAID_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro ödendi işaretlenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
