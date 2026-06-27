import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPlatformSettingsServiceError,
  listPlatformSettingsHistory,
} from "@/lib/admin/platform-settings";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

    const data = await listPlatformSettingsHistory(limit);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPlatformSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Geçmiş yüklenemedi." },
      { status: 500 }
    );
  }
}
