import { NextResponse } from "next/server";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  SettingsAccessError,
  getSettingsBundle,
  serializeCompanySettings,
  updateCashBankSettings,
  updateInvoiceSettings,
  updateNotificationSettings,
} from "@/lib/settings-service";
import {
  updateCashBankSettingsSchema,
  updateInvoiceSettingsSchema,
  updateNotificationSettingsSchema,
} from "@/lib/settings-utils";

type AuthPayload = {
  userId: string;
  companyId: string | null;
};

export async function GET() {
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

    const data = await getSettingsBundle(payload.companyId, payload.userId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ayarlar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

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
    const section = body.section as string;

    if (section === "invoice") {
      const parsed = updateInvoiceSettingsSchema.safeParse(body.data ?? body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Fatura ayarlarını kontrol edin.",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const settings = await updateInvoiceSettings({
        companyId: payload.companyId,
        userId: payload.userId,
        data: parsed.data,
      });

      return NextResponse.json({
        success: true,
        message: "Fatura ayarları kaydedildi.",
        data: { settings: serializeCompanySettings(settings) },
      });
    }

    if (section === "cash-bank") {
      const parsed = updateCashBankSettingsSchema.safeParse(body.data ?? body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Kasa ayarlarını kontrol edin.",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const settings = await updateCashBankSettings({
        companyId: payload.companyId,
        userId: payload.userId,
        data: parsed.data,
      });

      return NextResponse.json({
        success: true,
        message: "Kasa ve banka ayarları kaydedildi.",
        data: { settings: serializeCompanySettings(settings) },
      });
    }

    if (section === "notifications") {
      const parsed = updateNotificationSettingsSchema.safeParse(
        body.data ?? body
      );

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Bildirim ayarlarını kontrol edin.",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const settings = await updateNotificationSettings({
        companyId: payload.companyId,
        userId: payload.userId,
        data: parsed.data,
      });

      return NextResponse.json({
        success: true,
        message: "Bildirim ayarları kaydedildi.",
        data: { settings: serializeCompanySettings(settings) },
      });
    }

    return NextResponse.json(
      { success: false, message: "Geçersiz ayar bölümü." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof SettingsAccessError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("SETTINGS_PATCH_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ayarlar kaydedilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
