import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { markAllAsRead } from "@/lib/notification-service";

export async function PATCH() {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const updated = await markAllAsRead({
      companyId: auth.companyId,
      userId: auth.userId,
    });

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error("NOTIFICATIONS_READ_ALL_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bildirimler okundu olarak işaretlenemedi." },
      { status: 500 }
    );
  }
}
