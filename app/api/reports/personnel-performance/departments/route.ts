import { NextResponse } from "next/server";
import { getDepartmentPerformanceReport } from "@/lib/reports/department-performance-report";
import { requireApiModuleAccess } from "@/lib/module-access";

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

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error("DEPARTMENT_PERFORMANCE_REPORT_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Departman performans raporu yüklenirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
