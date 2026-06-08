import { NextResponse } from "next/server";
import { getCompanyUsersAndInvites } from "@/lib/company-users-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { SettingsAccessError } from "@/lib/settings-service";

function getBaseUrl(req: Request) {
  return req.headers.get("origin") || undefined;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { userId, companyId } = auth;

    const data = await getCompanyUsersAndInvites({
      companyId,
      userId,
      baseUrl: getBaseUrl(req),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_USERS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Kullanıcılar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
