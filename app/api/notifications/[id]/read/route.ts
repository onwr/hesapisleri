import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  markAsRead,
  NotificationServiceError,
} from "@/lib/notification-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const notification = await markAsRead({
      companyId: auth.companyId,
      userId: auth.userId,
      id,
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("NOTIFICATION_READ_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bildirim okundu olarak işaretlenemedi." },
      { status: 500 }
    );
  }
}
