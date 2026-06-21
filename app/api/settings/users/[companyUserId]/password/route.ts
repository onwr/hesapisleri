import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  updateCompanyUserPassword,
} from "@/lib/company-users-service";
import { updateCompanyUserPasswordSchema } from "@/lib/company-user-from-employee-utils";
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
    const parsed = updateCompanyUserPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Şifre bilgilerini kontrol edin.";
      return NextResponse.json(
        {
          success: false,
          message: firstError,
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { companyUserId } = await context.params;

    await updateCompanyUserPassword({
      companyId,
      userId,
      companyUserId,
      password: parsed.data.password,
    });

    return NextResponse.json({
      success: true,
      message: "Kullanıcı şifresi güncellendi.",
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USER_PASSWORD_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Şifre güncellenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
