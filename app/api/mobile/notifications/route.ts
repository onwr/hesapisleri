import { NextResponse } from "next/server";
import {
  requireMobileApiSession,
  requireMobileCompanyContext,
  MobileAuthError,
  mobileErrorResponse,
} from "@/lib/mobile/mobile-auth-guards";
import { listNotifications, NotificationServiceError } from "@/lib/notification-service";
import type { NotificationTab } from "@/lib/notification-utils";

const VALID_TABS: NotificationTab[] = ["all", "unread", "read"];
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const session = await requireMobileApiSession(request);
    if (!session.companyId) {
      return mobileErrorResponse("COMPANY_REQUIRED", "Aktif firma seçilmemiş.", 400);
    }
    const membership = await requireMobileCompanyContext(session, session.companyId);

    const url = new URL(request.url);
    const tabParam = url.searchParams.get("tab");
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, MAX_LIMIT);

    const tab: NotificationTab | undefined =
      tabParam && (VALID_TABS as string[]).includes(tabParam) ? (tabParam as NotificationTab) : undefined;

    const result = await listNotifications({
      companyId: membership.company.id,
      userId: session.userId,
      tab,
      cursor,
      limit,
    });

    // metadata güvenlik filtresi — mobil istemciye gönderilmez
    const items = result.notifications.map((s) => ({
      id: s.id,
      type: s.type,
      category: s.category,
      priority: s.priority,
      title: s.title,
      message: s.message,
      readAt: s.readAt,
      createdAt: s.createdAt,
      actionUrl: s.actionUrl,
    }));

    return NextResponse.json({ items, nextCursor: result.nextCursor ?? null });
  } catch (err) {
    if (err instanceof MobileAuthError) {
      return mobileErrorResponse(err.code, err.message, err.status);
    }
    if (err instanceof NotificationServiceError) {
      return mobileErrorResponse(
        err.status === 400 ? "INVALID_REQUEST" : "NOT_FOUND",
        err.message,
        err.status
      );
    }
    console.error("[mobile/notifications] hata:", err);
    return mobileErrorResponse("SERVER_ERROR", "Sunucu hatası.", 500);
  }
}
