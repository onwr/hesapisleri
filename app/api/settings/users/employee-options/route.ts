import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  getEmployeesForUserCreation,
} from "@/lib/company-users-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { SettingsAccessError } from "@/lib/settings-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const employees = await getEmployeesForUserCreation({
      companyId,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: { employees },
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USER_EMPLOYEE_OPTIONS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Personel listesi yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
