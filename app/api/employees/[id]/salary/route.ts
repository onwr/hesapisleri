import { NextResponse } from "next/server";
import {
  createEmployeeSalary,
  EmployeeServiceError,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageSalary");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const result = await createEmployeeSalary({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      amount: Number(body.amount),
      period: body.period,
      currency: body.currency,
      effectiveFrom: body.effectiveFrom
        ? new Date(body.effectiveFrom)
        : undefined,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_SALARY_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Maaş kaydı oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
