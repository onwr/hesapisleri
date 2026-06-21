import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  createEmployeeSalary,
  getEmployeeById,
  updateEmployeeSalary,
} from "@/lib/employee-service";
import {
  employeeSalaryFormSchema,
  employeeSalaryPatchSchema,
  normalizeSalaryPatchInput,
} from "@/lib/employee-salary-utils";
import { requireApiEmployeesPermission } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("view");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getEmployeeById({
      companyId: auth.companyId,
      employeeId: id,
      includeSensitive: true,
    });

    return NextResponse.json({
      success: true,
      salary: data.employee.activeSalary,
      currentBalance: data.employee.currentBalance,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[employees/salary] GET", error);
    return NextResponse.json(
      { success: false, message: "Maaş bilgisi yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageSalary");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = employeeSalaryPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Geçersiz maaş verisi.",
        },
        { status: 400 }
      );
    }

    const result = await updateEmployeeSalary({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      patch: normalizeSalaryPatchInput(parsed.data),
    });

    return NextResponse.json({
      success: true,
      salary: result.employee.activeSalary,
      employee: result.employee,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[employees/salary] PATCH", error);
    return NextResponse.json(
      { success: false, message: "Maaş bilgisi güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageSalary");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = employeeSalaryFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Geçersiz maaş verisi.",
        },
        { status: 400 }
      );
    }

    const patch = normalizeSalaryPatchInput(parsed.data);
    if (!patch.amount) {
      return NextResponse.json(
        { success: false, message: "Net maaş zorunludur." },
        { status: 400 }
      );
    }

    const result = await createEmployeeSalary({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      amount: patch.amount,
      grossAmount: patch.grossAmount,
      period: patch.period,
      currency: patch.currency,
      paymentDay: patch.paymentDay,
      iban: patch.iban,
      bankName: patch.bankName,
      effectiveFrom: patch.effectiveFrom,
      notes: patch.notes,
    });

    return NextResponse.json({
      success: true,
      salary: result.employee.activeSalary,
      employee: result.employee,
    });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[employees/salary] POST", error);
    return NextResponse.json(
      { success: false, message: "Maaş kaydı oluşturulamadı." },
      { status: 500 }
    );
  }
}
