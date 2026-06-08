import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

const TRIAL_DAYS = 14;

const registerSchema = z.object({
  name: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır."),
  email: z.string().email("Geçerli bir e-posta girin."),
  phone: z.string().optional(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),

  wantsCompanyInfo: z.boolean().optional(),

  companyName: z.string().optional(),
  taxNo: z.string().optional(),
  taxOffice: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

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

    const {
      name,
      email,
      phone,
      password,
      wantsCompanyInfo,
      companyName,
      taxNo,
      taxOffice,
    } = parsed.data;

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.",
        },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "OWNER",
          status: "ACTIVE",
        },
      });

      const finalCompanyName =
        wantsCompanyInfo && companyName?.trim()
          ? companyName.trim()
          : "İşletmem";

      const company = await tx.company.create({
        data: {
          name: finalCompanyName,
          taxNo: wantsCompanyInfo ? taxNo || null : null,
          taxOffice: wantsCompanyInfo ? taxOffice || null : null,
          phone: phone || null,
          email,
          status: "ACTIVE",
        },
      });

      await tx.companyUser.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
      });

      const now = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

      await tx.membershipPayment.create({
        data: {
          companyId: company.id,
          periodStart: now,
          periodEnd: trialEnd,
          amount: 1499,
          status: "PENDING",
          provider: "TRIAL",
          paymentRef: `TRIAL-${Date.now()}`,
          paidAt: null,
        },
      });

      await tx.warehouse.create({
        data: {
          companyId: company.id,
          name: "Ana Depo",
          code: "MAIN",
          isDefault: true,
          status: "ACTIVE",
        },
      });

      await tx.account.createMany({
        data: [
          {
            companyId: company.id,
            type: "CASH",
            name: "Merkez Kasa",
            balance: 0,
            currency: "TRY",
            status: "ACTIVE",
          },
          {
            companyId: company.id,
            type: "BANK",
            name: "Banka Hesabı",
            bankName: "Varsayılan Banka",
            balance: 0,
            currency: "TRY",
            status: "ACTIVE",
          },
        ],
      });

      await tx.notification.create({
        data: {
          companyId: company.id,
          userId: user.id,
          type: "SUCCESS",
          title: "Hesabınız oluşturuldu",
          message:
            wantsCompanyInfo && companyName?.trim()
              ? `Firma bilgilerinizle hesabınız açıldı. ${TRIAL_DAYS} gün ücretsiz deneme süreniz başladı.`
              : `Hesabınız açıldı. ${TRIAL_DAYS} gün ücretsiz deneme süreniz başladı. Firma bilgilerinizi panelden tamamlayabilirsiniz.`,
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: company.id,
          userId: user.id,
          action: "REGISTER",
          module: "auth",
          message: "Yeni kullanıcı kaydı oluşturuldu.",
        },
      });

      return { user, company };
    });

    const token = signToken({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.company.id,
    });

    const response = NextResponse.json({
      success: true,
      message: "Kayıt başarılı.",
      data: {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
        company: {
          id: result.company.id,
          name: result.company.name,
        },
        trialDays: TRIAL_DAYS,
      },
    });

    response.cookies.set("hesapisleri_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("REGISTER_ERROR", error);

    return NextResponse.json(
      {
        success: false,
        message: "Kayıt oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
