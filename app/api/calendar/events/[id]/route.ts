import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  CalendarServiceError,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/calendar-service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("calendar");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();

    const event = await updateCalendarEvent({
      companyId: auth.companyId,
      eventId: id,
      data: body,
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CALENDAR_EVENT_PATCH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Takvim kaydı güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireApiModuleAccess("calendar");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;

    await deleteCalendarEvent({
      companyId: auth.companyId,
      eventId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CALENDAR_EVENT_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Takvim kaydı silinemedi." },
      { status: 500 }
    );
  }
}
