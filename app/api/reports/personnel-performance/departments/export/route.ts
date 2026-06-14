import { NextResponse } from "next/server";
import {
  buildDepartmentPerformanceCsv,
  getDepartmentPerformanceReport,
} from "@/lib/reports/department-performance-report";
import { requireApiModuleAccess } from "@/lib/module-access";

function buildDepartmentPerformanceExportFilename(from: string, to: string) {
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);
  return `departman-performans-${fromDate}-${toDate}.csv`;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);

    const report = await getDepartmentPerformanceReport({
      companyId: auth.companyId,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const csv = buildDepartmentPerformanceCsv(report);
    const filename = buildDepartmentPerformanceExportFilename(
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
    console.error("DEPARTMENT_PERFORMANCE_EXPORT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Rapor dışa aktarılırken bir hata oluştu." },
      { status: 400 }
    );
  }
}
