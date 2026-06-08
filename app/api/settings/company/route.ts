import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  SettingsAccessError,
  serializeCompany,
  serializeCompanySettings,
  updateCompanySettings,
} from "@/lib/settings-service";
import {
  StorageConfigError,
  StorageUploadError,
} from "@/lib/storage/cdn";
import { updateCompanySettingsSchema } from "@/lib/settings-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function PATCH(req: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        { success: false, message: "Oturum geçersiz." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = updateCompanySettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Bilgileri kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await updateCompanySettings({
      companyId: payload.companyId,
      userId: payload.userId,
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: "Firma bilgileri güncellendi.",
      data: {
        company: serializeCompany(result.company),
        settings: serializeCompanySettings(result.settings),
      },
    });
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof StorageConfigError) {
      return NextResponse.json(
        { success: false, message: "CDN yapılandırması eksik." },
        { status: 500 }
      );
    }

    if (error instanceof StorageUploadError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (error instanceof Error && error.message.includes("yükleyebilirsiniz")) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    console.error("SETTINGS_COMPANY_PATCH_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Firma bilgileri güncellenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
