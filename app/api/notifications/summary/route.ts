import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { getNotificationSummary } from "@/lib/notification-service";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const summary = await getNotificationSummary({
      companyId: auth.companyId,
      userId: auth.userId,
    });

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("NOTIFICATIONS_SUMMARY_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bildirim özeti alınamadı." },
      { status: 500 }
    );
  }
}
