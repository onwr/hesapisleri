import { NextResponse } from "next/server";
import {
  createPerformanceTarget,
  listPerformanceTargets,
  PerformanceTargetServiceError,
} from "@/lib/employee-performance-target-service";
import {
  parsePerformanceDepartment,
  parsePerformanceEmployeeId,
} from "@/lib/employee-performance-utils";
import { normalizeOptionalNumber, parseTargetScope } from "@/lib/employee-performance-target-utils";
import { requireApiEmployeesPermission, requireApiModuleAccess } from "@/lib/module-access";

export async function GET(request: Request) {
  try {
    const auth = await requireApiModuleAccess("employees");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);

    const targets = await listPerformanceTargets({
      companyId: auth.companyId,
      periodStart: searchParams.get("from"),
      periodEnd: searchParams.get("to"),
      employeeId: parsePerformanceEmployeeId(searchParams.get("employeeId")),
      department: parsePerformanceDepartment(searchParams.get("department")),
      scope: parseTargetScope(searchParams.get("scope")),
    });

    return NextResponse.json({ success: true, targets });
  } catch (error) {
    if (error instanceof PerformanceTargetServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PERFORMANCE_TARGETS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hedefler yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiEmployeesPermission("manageTargets");
    if ("error" in auth) return auth.error;

    const body = await request.json();

    const target = await createPerformanceTarget({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: body.employeeId || null,
      department: body.department || null,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      salesCountTarget: normalizeOptionalNumber(body.salesCountTarget),
      revenueTarget: normalizeOptionalNumber(body.revenueTarget),
      collectionTarget: normalizeOptionalNumber(body.collectionTarget),
      maxLeaveDays: normalizeOptionalNumber(body.maxLeaveDays),
      payrollEfficiencyTarget: normalizeOptionalNumber(
        body.payrollEfficiencyTarget
      ),
      scoreTarget: normalizeOptionalNumber(body.scoreTarget),
      notes: body.notes,
    });

    return NextResponse.json({ success: true, target });
  } catch (error) {
    if (error instanceof PerformanceTargetServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PERFORMANCE_TARGETS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hedef oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
