import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { deleteNotification, NotificationServiceError } from "@/lib/notification-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireMobileApiSession(request);
    if (!session.companyId) {
      return mobileErrorResponse("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
    }
    const membership = await requireMobileCompanyContext(session, session.companyId);

    const { id: notificationId } = await params;
    if (!notificationId) {
      return mobileErrorResponse("INVALID_REQUEST", "Bildirim ID eksik.", 400);
    }

    await deleteNotification({
      id: notificationId,
      companyId: membership.company.id,
      userId: session.userId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    if (err instanceof NotificationServiceError) {
      return mobileErrorResponse("NOT_FOUND", err.message, err.status);
    }
    console.error("[mobile/notifications/[id]] hata:", err);
    return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
  }
}
