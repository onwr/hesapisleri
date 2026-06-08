import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  CompanyUsersError,
  createCompanyInvite,
} from "@/lib/company-users-service";
import { createInviteSchema } from "@/lib/company-users-utils";
import { SettingsAccessError } from "@/lib/settings-service";

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const body = await req.json();
    const parsed = createInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Davet bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await createCompanyInvite({
      companyId,
      userId,
      email: parsed.data.email,
      role: parsed.data.role,
      baseUrl: req.headers.get("origin") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Davet oluşturuldu.",
      data: result,
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_INVITE_CREATE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Davet oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
