import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { z } from "zod";
import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import {
  StorageConfigError,
  StorageUploadError,
  resolveUploadedImageUrl,
} from "@/lib/storage/cdn";

const CDN_COMPANY_FOLDER = "hesapisleri/companies";

const updateCompanySchema = z.object({
  name: z.string().min(2, "Firma adı zorunludur."),
  taxNo: z.string().optional(),
  taxOffice: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .email("Geçerli bir e-posta girin.")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  logoUrl: z.string().optional().or(z.literal("")),
});

export async function PUT(req: Request) {
  try {
    const auth = await requireApiModuleAccess("settings");
    if ("error" in auth) return auth.error;

    const companyId = auth.companyId;
    const userId = auth.userId;
    const body = await req.json();
    const parsed = updateCompanySchema.safeParse(body);

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

    const { name, taxNo, taxOffice, phone, email, address, logoUrl } =
      parsed.data;

    const companyUser = await db.companyUser.findFirst({
      where: {
        userId: userId,
        companyId: companyId,
      },
    });

    if (!companyUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu firmayı güncelleme yetkiniz yok.",
        },
        { status: 403 }
      );
    }

    const resolvedLogoUrl = logoUrl
      ? await resolveUploadedImageUrl(
          logoUrl,
          `${CDN_COMPANY_FOLDER}/${companyId}`
        )
      : null;

    const company = await db.company.update({
      where: {
        id: companyId,
      },
      data: {
        name,
        taxNo: taxNo || null,
        taxOffice: taxOffice || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        logoUrl: resolvedLogoUrl,
      },
    });

    await db.activityLog.create({
      data: {
        companyId: company.id,
        userId: userId,
        action: "UPDATE",
        module: "company",
        message: "Firma bilgileri güncellendi.",
      },
    });

    await createNotification({
      companyId: company.id,
      userId: userId,
      type: "SUCCESS",
      category: "SYSTEM",
      module: "settings",
      entityType: "COMPANY",
      entityId: company.id,
      actionUrl: "/settings",
      title: "Firma bilgileri tamamlandı",
      message: "Firma bilgileriniz başarıyla güncellendi.",
    });

    return NextResponse.json({
      success: true,
      message: "Firma bilgileri güncellendi.",
      data: {
        company,
      },
    });
  } catch (error) {
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

    console.error("COMPANY_UPDATE_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Firma bilgileri güncellenirken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
