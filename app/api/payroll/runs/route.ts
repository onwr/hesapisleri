import { NextResponse } from "next/server";
import {
  createPayrollRun,
  listPayrollRuns,
  PayrollServiceError,
} from "@/lib/payroll-service";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const search = url.searchParams.get("q") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");

    const result = await listPayrollRuns({
      companyId: auth.companyId,
      status: status as never,
      search,
      page: Number.isFinite(page) ? page : 1,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_RUNS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordrolar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiEmployeesPermission("managePayroll");
    if ("error" in auth) return auth.error;

    const body = await req.json();

    const result = await createPayrollRun({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      payDate: body.payDate,
      title: body.title,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_RUNS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
