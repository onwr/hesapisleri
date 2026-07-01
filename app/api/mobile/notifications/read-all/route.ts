import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { markAllAsRead } from "@/lib/notification-service";

export async function POST(request: Request) {
  try {
    const session = await requireMobileApiSession(request);
    if (!session.companyId) {
      return mobileErrorResponse("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
    }
    const membership = await requireMobileCompanyContext(session, session.companyId);

    await markAllAsRead({
      companyId: membership.company.id,
      userId: session.userId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    console.error("[mobile/notifications/read-all] hata:", err);
    return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
  }
}
