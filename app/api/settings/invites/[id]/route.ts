import { NextResponse } from "next/server";
import {
  CompanyUsersError,
  cancelCompanyInvite,
} from "@/lib/company-users-service";
import { requireApiModuleAccess } from "@/lib/module-access";
import { SettingsAccessError } from "@/lib/settings-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("settings-users");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    await cancelCompanyInvite({
      companyId: auth.companyId,
      userId: auth.userId,
      inviteId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Davet iptal edildi.",
    });
  } catch (error) {
    if (error instanceof CompanyUsersError || error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_INVITE_CANCEL_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Davet iptal edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
