import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  AuthCompaniesError,
  switchUserCompany,
} from "@/lib/auth-companies-service";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import { getPostAuthRedirectPath, resolveEffectiveRole } from "@/lib/permission-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

const switchCompanySchema = z.object({
  companyId: z.string().min(1, "Firma seçimi gerekli."),
});

export async function POST(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = switchCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Firma seçimini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await switchUserCompany({
      userId: payload.userId,
      companyId: parsed.data.companyId,
    });

    const effectiveRole = resolveEffectiveRole({
      role: result.membershipRole,
      isOwner: result.isOwner,
    });

    const response = NextResponse.json({
      success: true,
      message: "Aktif firma güncellendi.",
      data: {
        companyId: result.companyId,
        companyName: result.companyName,
        redirectTo: getPostAuthRedirectPath(effectiveRole, result.isOwner),
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
    if (error instanceof AuthCompaniesError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("AUTH_SWITCH_COMPANY_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firma değiştirilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
