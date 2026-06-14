import { NextResponse } from "next/server";
import {
  buildPayrollCsvWithBom,
  buildPayrollExportFilename,
} from "@/lib/payroll-export-utils";
import {
  getPayrollRunDetail,
  PayrollServiceError,
} from "@/lib/payroll-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { db } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "csv";

    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json(
        { success: false, message: "Desteklenen formatlar: csv, xlsx." },
        { status: 400 }
      );
    }

    const [payrollRun, company] = await Promise.all([
      getPayrollRunDetail({
        companyId: auth.companyId,
        payrollRunId: id,
      }),
      db.company.findUnique({
        where: { id: auth.companyId },
        select: { name: true },
      }),
    ]);

    const csv = buildPayrollCsvWithBom(payrollRun, company?.name ?? "Firma");
    const filename = buildPayrollExportFilename(
      new Date(payrollRun.periodStart),
      new Date(payrollRun.periodEnd),
      format === "xlsx" ? "xlsx" : "csv"
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof PayrollServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PAYROLL_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bordro dışa aktarılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
