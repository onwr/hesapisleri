import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPartnerSettingsServiceError,
  getAdminPartnerSettings,
  updateAdminPartnerSettings,
} from "@/lib/admin/partner-settings";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const data = await getAdminPartnerSettings();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AdminPartnerSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ayarlar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const data = await updateAdminPartnerSettings(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Ayarlar güncellendi.",
      data,
    });
  } catch (error) {
    if (error instanceof AdminPartnerSettingsServiceError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Ayarlar güncellenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, message: "Ayar güncellemesi için PUT kullanın." },
    { status: 405 }
  );
}
