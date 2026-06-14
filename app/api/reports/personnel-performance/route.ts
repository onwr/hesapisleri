import { NextResponse } from "next/server";
import { getPersonnelPerformanceReport } from "@/lib/employee-performance-service";
import {
  parsePerformanceDepartment,
  parsePerformanceEmployeeId,
} from "@/lib/employee-performance-utils";
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

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    console.error("PERSONNEL_PERFORMANCE_REPORT_ERROR", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Personel performans raporu yüklenirken bir hata oluştu.",
      },
      { status: 400 }
    );
  }
}
