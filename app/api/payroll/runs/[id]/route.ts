import { NextResponse } from "next/server";
import {
  cancelPayrollRun,
  getPayrollRunDetail,
  PayrollServiceError,
} from "@/lib/payroll-service";
import { db } from "@/lib/prisma";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const payrollRun = await getPayrollRunDetail({
      companyId: auth.companyId,
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

    console.error("PAYROLL_RUN_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const existing = await db.payrollRun.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Bordro kaydı bulunamadı." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, message: "Yalnızca taslak bordrolar düzenlenebilir." },
        { status: 400 }
      );
    }

    await db.payrollRun.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
        ...(body.payDate !== undefined
          ? { payDate: body.payDate ? new Date(body.payDate) : null }
          : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes?.trim() || null }
          : {}),
      },
    });

    const payrollRun = await getPayrollRunDetail({
      companyId: auth.companyId,
      payrollRunId: id,
    });

    return NextResponse.json({ success: true, payrollRun });
  } catch (error) {
    console.error("PAYROLL_RUN_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const payrollRun = await cancelPayrollRun({
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

    console.error("PAYROLL_RUN_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro iptal edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
