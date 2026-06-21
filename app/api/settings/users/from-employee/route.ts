import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  createCompanyUserFromEmployee,
} from "@/lib/company-users-service";
import { createUserFromEmployeeSchema } from "@/lib/company-user-from-employee-utils";
import { requireApiModuleAccess } from "@/lib/module-access";
import { SettingsAccessError } from "@/lib/settings-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;
    const body = await req.json();
    const parsed = createUserFromEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Form bilgilerini kontrol edin.";
      return NextResponse.json(
        {
          success: false,
          message: firstError,
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const user = await createCompanyUserFromEmployee({
      companyId,
      userId,
      employeeId: parsed.data.employeeId,
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role,
      status: parsed.data.status,
    });

    return NextResponse.json({
      success: true,
      message: "Kullanıcı oluşturuldu.",
      data: { user },
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USER_FROM_EMPLOYEE_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcı oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
