import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthToken, verifyToken } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { resolvePartnerForUser } from "@/lib/partner-service";

type AuthPayload = {
  userId: string;
  email?: string;
};

export async function requirePartnerApi() {
  const token = await getAuthToken();

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken<AuthPayload>(token);

  if (!payload?.userId) {
    return {
      error: NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      ),
    };
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return {
      error: NextResponse.json(
        { success: false, message: "Hesabınız aktif değil." },
        { status: 403 }
      ),
    };
  }

  const partner = await resolvePartnerForUser(user.id, user.email);

  if (!partner) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Partner paneline erişim yetkiniz yok.",
        },
        { status: 403 }
      ),
    };
  }

  return { user, partner };
}

export async function readPartnerAttributionFromCookies() {
  const jar = await cookies();
  return {
    referralCode: jar.get("partner_ref")?.value ?? null,
    clickId: jar.get("partner_click_id")?.value ?? null,
  };
}
