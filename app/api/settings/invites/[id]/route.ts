import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  CompanyUsersError,
  cancelCompanyInvite,
} from "@/lib/company-users-service";
import { SettingsAccessError } from "@/lib/settings-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    await cancelCompanyInvite({
      companyId: payload.companyId,
      userId: payload.userId,
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
