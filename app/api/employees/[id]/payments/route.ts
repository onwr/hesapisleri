import { NextResponse } from "next/server";
import {
  createEmployeePayment,
  EmployeeServiceError,
} from "@/lib/employee-service";
import { invalidateTenantCaches } from "@/lib/tenant-cache/tenant-cache-invalidation";
import { employeePaymentDisbursesCash } from "@/lib/employee-payment-type-mapping";
import {
  requireApiEmployeesPermission,
} from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const accountId = body.relatedAccountId?.trim() || "";
    const paymentType = body.type as string;

    if (accountId && employeePaymentDisbursesCash(paymentType as never)) {
      const paymentAuth = await requireApiEmployeesPermission("processPayments");
      if ("error" in paymentAuth) return paymentAuth.error;
    }

    const payment = await createEmployeePayment({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      type: body.type,
      direction: body.direction,
      amount: Number(body.amount),
      currency: body.currency,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      description: body.description,
      relatedExpenseId: body.relatedExpenseId,
      relatedAccountId: body.relatedAccountId,
      payImmediately: Boolean(accountId),
    });

    invalidateTenantCaches(auth.companyId, {
      reason: "employee-payment",
      entityIds: { employeeId: id },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        affectedIds: [id, payment.id],
        status: payment.status,
      },
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_PAYMENT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Ödeme kaydı oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
