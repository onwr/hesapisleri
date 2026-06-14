import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EmployeeServiceError,
  updateEmployeeStatus,
} from "@/lib/employee-service";
import { requireApiEmployeesPermission } from "@/lib/module-access";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "PASSIVE", "ON_LEAVE", "TERMINATED"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçerli bir durum gönderin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const employee = await updateEmployeeStatus({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      employeeId: id,
      status: parsed.data.status,
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_STATUS_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Çalışan durumu güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
