import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPlatformSettingsServiceError,
  getAdminPlatformSettings,
  updateAdminPlatformSettings,
} from "@/lib/admin/platform-settings";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const data = await getAdminPlatformSettings();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPlatformSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Platform ayarları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const data = await updateAdminPlatformSettings(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Platform ayarları güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminPlatformSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Platform ayarları güncellenemedi." },
      { status: 400 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, message: "Platform ayarları için PATCH desteklenmiyor." },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, message: "Platform ayarları silinemez." },
    { status: 405 }
  );
}
