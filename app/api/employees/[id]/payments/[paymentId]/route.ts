import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  updateEmployeePaymentStatus,
} from "@/lib/employee-service";
import {
  buildMarkPaymentPaidApiResponse,
  validateMarkEmployeePaymentPaidInput,
} from "@/lib/employee-payment-finance-utils";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = {
  params: Promise<{ id: string; paymentId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("processPayments");
    if ("error" in auth) return auth.error;

    const { id, paymentId } = await context.params;
    const body = await req.json();

    const validation = validateMarkEmployeePaymentPaidInput({
      status: body.status,
      relatedAccountId: body.relatedAccountId,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: validation.status }
      );
    }

    const result = await updateEmployeePaymentStatus({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      paymentId,
      status: body.status,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
      relatedAccountId: body.relatedAccountId,
      notes: body.notes,
    });

    if ("finance" in result) {
      return NextResponse.json(
        buildMarkPaymentPaidApiResponse({
          payment: result.payment,
          finance: result.finance,
        })
      );
    }

    return NextResponse.json({ success: true, payment: result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_PAYMENT_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ödeme güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
