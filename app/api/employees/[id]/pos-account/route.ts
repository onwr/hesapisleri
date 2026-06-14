import { NextResponse } from "next/server";
import {
  createEmployeePosAccount,
  disableEmployeePosAccount,
  updateEmployeePosAccount,
} from "@/lib/employee-pos-account-service";
import { EmployeeServiceError } from "@/lib/employee-service";
import { requireApiEmployeesPermission } from "@/lib/module-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    if (!body.username || !body.password) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı adı ve şifre zorunludur." },
        { status: 400 }
      );
    }

    const result = await createEmployeePosAccount({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      actorRole: auth.session.effectiveRole,
      actorIsOwner: auth.session.companyUser.isOwner,
      employeeId: id,
      username: body.username,
      password: body.password,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_POS_ACCOUNT_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "POS hesabı oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const result = await updateEmployeePosAccount({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      actorRole: auth.session.effectiveRole,
      actorIsOwner: auth.session.companyUser.isOwner,
      employeeId: id,
      password: body.password,
      status: body.status,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_POS_ACCOUNT_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "POS hesabı güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiEmployeesPermission("manageRecords");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    const result = await disableEmployeePosAccount({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      actorRole: auth.session.effectiveRole,
      actorIsOwner: auth.session.companyUser.isOwner,
      employeeId: id,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("EMPLOYEE_POS_ACCOUNT_DISABLE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "POS erişimi kapatılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
