import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  CalendarServiceError,
  createCalendarEvent,
  getCalendarEvents,
} from "@/lib/calendar-service";
import {
  parseCalendarDateRange,
  parseCalendarTypesParam,
  parseIncludeSystemParam,
} from "@/lib/calendar-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireApiModuleAccess("calendar");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const range = parseCalendarDateRange({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    if (!range.ok) {
      return NextResponse.json(
        { success: false, message: range.message },
        { status: 400 }
      );
    }

    const types = parseCalendarTypesParam(searchParams.get("types"));
    const includeSystem = parseIncludeSystemParam(
      searchParams.get("includeSystem")
    );

    const events = await getCalendarEvents({
      companyId: auth.companyId,
      from: range.from,
      to: range.to,
      types,
      includeSystem,
    });

    return NextResponse.json({ success: true, events });
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("CALENDAR_EVENTS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Takvim kayıtları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiModuleAccess("calendar");
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const event = await createCalendarEvent({
      companyId: auth.companyId,
      userId: auth.userId,
      data: body,
    });

    return NextResponse.json(
      { success: true, event },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CalendarServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, errors: error.message },
        { status: error.status }
      );
    }

    console.error("CALENDAR_EVENTS_POST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Takvim kaydı oluşturulamadı." },
      { status: 500 }
    );
  }
}
