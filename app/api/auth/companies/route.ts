import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  AuthCompaniesError,
  listUserCompanies,
} from "@/lib/auth-companies-service";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function GET() {
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

    const data = await listUserCompanies(
      payload.userId,
      payload.companyId ?? null
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof AuthCompaniesError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("AUTH_COMPANIES_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firmalar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
