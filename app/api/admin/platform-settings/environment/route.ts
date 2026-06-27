import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPlatformSettingsServiceError,
  getAdminPlatformEnvironment,
} from "@/lib/admin/platform-settings";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const data = await getAdminPlatformEnvironment();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPlatformSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ortam durumu yüklenemedi." },
      { status: 500 }
    );
  }
}
