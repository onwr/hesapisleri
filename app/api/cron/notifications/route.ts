import { NextResponse } from "next/server";
import { runProactiveNotificationCron } from "@/lib/notification-cron-service";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const summary = await runProactiveNotificationCron();

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Bildirim cron işlemi başarısız.",
      },
      { status: 500 }
    );
  }
}
