import { NextResponse } from "next/server";
import { getOptionalAuthenticatedApiSession } from "@/lib/module-access";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import {
  CompanyUsersError,
  acceptCompanyInvite,
} from "@/lib/company-users-service";
import { acceptInviteSchema } from "@/lib/company-users-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = acceptInviteSchema.safeParse(body);

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

    const authSession = await getOptionalAuthenticatedApiSession();

    const result = await acceptCompanyInvite({
      token: parsed.data.token,
      userId: authSession?.userId,
      name: parsed.data.name,
      password: parsed.data.password,
    });

    const response = NextResponse.json({
      success: true,
      message: "Davet başarıyla kabul edildi.",
      data: {
        companyId: result.companyId,
        companyName: result.companyName,
        redirectTo: result.redirectTo,
      },
    });

    attachAuthCookie(response, {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.companyId,
    });

    return response;
  } catch (error) {
    if (error instanceof CompanyUsersError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          code: error.code,
        },
        { status: error.status }
      );
    }

    console.error("INVITE_ACCEPT_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Davet kabul edilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
