import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getPartnershipAccessState } from "@/lib/partnership-access";
import {
  PartnerServiceError,
  submitPartnerApplication,
} from "@/lib/partner-service";
import { partnerApplicationSchema } from "@/lib/partner-utils";

export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<{ userId: string }>(token);
    if (!payload?.userId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "Hesabınız aktif değil." },
        { status: 403 }
      );
    }

    const state = await getPartnershipAccessState(user.id, user.email);

    return NextResponse.json({ success: true, data: { state } });
  } catch (error) {
    console.error("PARTNER_APPLICATION_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Başvuru durumu yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = partnerApplicationSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? "Başvuru bilgilerini kontrol edin.";
      return NextResponse.json(
        {
          success: false,
          message: firstError,
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    await submitPartnerApplication(parsed.data);

    return NextResponse.json({
      success: true,
      message:
        "Başvurunuz alındı. İnceleme sonrası sizinle iletişime geçeceğiz.",
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PARTNER_APPLICATION_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Başvuru gönderilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
