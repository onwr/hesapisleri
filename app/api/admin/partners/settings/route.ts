import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PartnerServiceError,
  getPartnerSettings,
  updatePartnerSettings,
} from "@/lib/partner-service";
import { updatePartnerSettingsSchema } from "@/lib/partner-utils";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const settings = await getPartnerSettings();

    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    console.error("ADMIN_PARTNER_SETTINGS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ayarlar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = updatePartnerSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Ayar bilgilerini kontrol edin." },
        { status: 400 }
      );
    }

    const settings = await updatePartnerSettings(parsed.data);

    return NextResponse.json({
      success: true,
      message: "Ayarlar güncellendi.",
      data: { settings },
    });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("ADMIN_PARTNER_SETTINGS_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ayarlar güncellenemedi." },
      { status: 500 }
    );
  }
}
