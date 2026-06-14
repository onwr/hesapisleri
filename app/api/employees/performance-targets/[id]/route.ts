import { NextResponse } from "next/server";
import {
  deletePerformanceTarget,
  PerformanceTargetServiceError,
  updatePerformanceTarget,
} from "@/lib/employee-performance-target-service";
import { normalizeOptionalNumber } from "@/lib/employee-performance-target-utils";
import { requireApiEmployeesPermission } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageTargets");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const target = await updatePerformanceTarget({
      companyId: auth.companyId,
      targetId: id,
      salesCountTarget:
        body.salesCountTarget !== undefined
          ? normalizeOptionalNumber(body.salesCountTarget)
          : undefined,
      revenueTarget:
        body.revenueTarget !== undefined
          ? normalizeOptionalNumber(body.revenueTarget)
          : undefined,
      collectionTarget:
        body.collectionTarget !== undefined
          ? normalizeOptionalNumber(body.collectionTarget)
          : undefined,
      maxLeaveDays:
        body.maxLeaveDays !== undefined
          ? normalizeOptionalNumber(body.maxLeaveDays)
          : undefined,
      payrollEfficiencyTarget:
        body.payrollEfficiencyTarget !== undefined
          ? normalizeOptionalNumber(body.payrollEfficiencyTarget)
          : undefined,
      scoreTarget:
        body.scoreTarget !== undefined
          ? normalizeOptionalNumber(body.scoreTarget)
          : undefined,
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

    console.error("PERFORMANCE_TARGET_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hedef güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageTargets");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    await deletePerformanceTarget({
      companyId: auth.companyId,
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PerformanceTargetServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PERFORMANCE_TARGET_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Hedef silinirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
