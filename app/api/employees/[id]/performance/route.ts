import { NextResponse } from "next/server";
import {
  EmployeeServiceError,
  getEmployeePerformance,
} from "@/lib/employee-service";
import { requireApiModuleAccess } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);

    const performance = await getEmployeePerformance({
      companyId: auth.companyId,
      employeeId: id,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    return NextResponse.json({ success: true, performance });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_PERFORMANCE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Performans verisi yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
