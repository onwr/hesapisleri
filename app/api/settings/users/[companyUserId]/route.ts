import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  removeCompanyUser,
  updateCompanyUserRole,
} from "@/lib/company-users-service";
import { changeCompanyUserRoleSchema } from "@/lib/company-users-utils";
import { requireApiModuleAccess } from "@/lib/module-access";
import { SettingsAccessError } from "@/lib/settings-service";

type RouteContext = {
  params: Promise<{ companyUserId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = changeCompanyUserRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Rol bilgisini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { companyUserId } = await context.params;

    const user = await updateCompanyUserRole({
      companyId,
      userId,
      companyUserId,
      role: parsed.data.role,
    });

    return NextResponse.json({
      success: true,
      message: "Kullanıcı rolü güncellendi.",
      data: { user },
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USER_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Rol güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const { companyUserId } = await context.params;

    const user = await removeCompanyUser({
      companyId,
      userId,
      companyUserId,
    });

    return NextResponse.json({
      success: true,
      message: "Kullanıcı firmadan çıkarıldı.",
      data: { user },
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USER_DELETE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcı çıkarılırken bir hata oluştu." },
      { status: 500 }
    );
  }
}
