import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  getNotificationSummary,
  listNotifications,
  NotificationServiceError,
} from "@/lib/notification-service";
import { buildNotificationListQuery } from "@/lib/notification-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const query = buildNotificationListQuery({
      tab: searchParams.get("tab"),
      category: searchParams.get("category"),
      priority: searchParams.get("priority"),
      search: searchParams.get("search"),
      limit: searchParams.get("limit"),
    });

    const [{ notifications, nextCursor }, summary] = await Promise.all([
      listNotifications({
        companyId: auth.companyId,
        userId: auth.userId,
        tab: query.tab,
        category: query.category,
        priority: query.priority,
        search: query.search,
        cursor: searchParams.get("cursor"),
        limit: query.limit,
      }),
      getNotificationSummary({
        companyId: auth.companyId,
        userId: auth.userId,
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      nextCursor,
      summary: {
        unread: summary.unread,
        today: summary.today,
        critical: summary.critical,
      },
    });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("NOTIFICATIONS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bildirimler yüklenemedi." },
      { status: 500 }
    );
  }
}
