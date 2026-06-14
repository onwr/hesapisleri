import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  deleteNotification,
  NotificationServiceError,
} from "@/lib/notification-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("notifications");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    await deleteNotification({
      companyId: auth.companyId,
      userId: auth.userId,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotificationServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("NOTIFICATION_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Bildirim silinemedi." },
      { status: 500 }
    );
  }
}
