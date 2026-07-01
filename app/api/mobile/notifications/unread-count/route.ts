import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { getUnreadCount } from "@/lib/notification-service";

export async function GET(request: Request) {
  try {
    const session = await requireMobileApiSession(request);
    if (!session.companyId) {
      return mobileErrorResponse("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
    }
    const membership = await requireMobileCompanyContext(session, session.companyId);

    const count = await getUnreadCount({
      companyId: membership.company.id,
      userId: session.userId,
    });

    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    console.error("[mobile/notifications/unread-count] hata:", err);
    return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
  }
}
