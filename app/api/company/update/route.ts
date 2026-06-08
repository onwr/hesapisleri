import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthToken, verifyToken } from "@/lib/auth";
import {
  StorageConfigError,
  StorageUploadError,
  resolveUploadedImageUrl,
} from "@/lib/storage/cdn";

type AuthPayload = {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
};

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
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    const payload = verifyToken<AuthPayload>(token);

    if (!payload?.userId || !payload.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Oturum geçersiz.",
        },
        { status: 401 }
      );
    }

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
        userId: payload.userId,
        companyId: payload.companyId,
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
          `${CDN_COMPANY_FOLDER}/${payload.companyId}`
        )
      : null;

    const company = await db.company.update({
      where: {
        id: payload.companyId,
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
        userId: payload.userId,
        action: "UPDATE",
        module: "company",
        message: "Firma bilgileri güncellendi.",
      },
    });

    await db.notification.create({
      data: {
        companyId: company.id,
        userId: payload.userId,
        type: "SUCCESS",
        title: "Firma bilgileri tamamlandı",
        message: "Firma bilgileriniz başarıyla güncellendi.",
      },
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
