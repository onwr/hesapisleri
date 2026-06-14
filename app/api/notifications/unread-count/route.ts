import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getUnreadCount } from "@/lib/notification-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const count = await getUnreadCount({
      companyId: auth.companyId,
      userId: auth.userId,
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("NOTIFICATIONS_UNREAD_COUNT_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Okunmamış bildirim sayısı alınamadı." },
      { status: 500 }
    );
  }
}
