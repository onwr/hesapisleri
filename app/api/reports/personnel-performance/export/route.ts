import { NextResponse } from "next/server";
import { getPersonnelPerformanceReport } from "@/lib/employee-performance-service";
import {
  parsePerformanceDepartment,
  parsePerformanceEmployeeId,
} from "@/lib/employee-performance-utils";
import {
  buildPersonnelPerformanceCsv,
  buildPersonnelPerformanceExportFilename,
} from "@/lib/reports/personnel-performance-report";
import { requireApiModuleAccess } from "@/lib/module-access";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);

    const report = await getPersonnelPerformanceReport({
      companyId: auth.companyId,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      department: parsePerformanceDepartment(searchParams.get("department")),
      employeeId: parsePerformanceEmployeeId(searchParams.get("employeeId")),
    });

    const csv = buildPersonnelPerformanceCsv(report);
    const filename = buildPersonnelPerformanceExportFilename(
      report.period.from,
      report.period.to
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PERSONNEL_PERFORMANCE_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Rapor dışa aktarılırken bir hata oluştu." },
      { status: 400 }
    );
  }
}
