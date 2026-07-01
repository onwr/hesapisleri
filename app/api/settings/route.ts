import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import {
  SettingsAccessError,
  getSettingsBundle,
  serializeCompanySettings,
  updateCashBankSettings,
  updateInvoiceSettings,
  updateNotificationSettings,
  updateSalesSettings,
} from "@/lib/settings-service";
import {
  updateCashBankSettingsSchema,
  updateInvoiceSettingsSchema,
  updateNotificationSettingsSchema,
  updateSalesSettingsSchema,
} from "@/lib/settings-utils";

export async function GET() {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const data = await getSettingsBundle(companyId, userId);

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
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
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
        companyId: companyId,
        userId: userId,
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
        companyId: companyId,
        userId: userId,
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
        companyId: companyId,
        userId: userId,
        data: parsed.data,
      });

      return NextResponse.json({
        success: true,
        message: "Bildirim ayarları kaydedildi.",
        data: { settings: serializeCompanySettings(settings) },
      });
    }

    if (section === "sales") {
      const parsed = updateSalesSettingsSchema.safeParse(body.data ?? body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            message: "Satış ayarlarını kontrol edin.",
            errors: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const settings = await updateSalesSettings({
        companyId: companyId,
        userId: userId,
        data: parsed.data,
      });

      return NextResponse.json({
        success: true,
        message: "Satış ayarları kaydedildi.",
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
