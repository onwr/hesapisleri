import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import {
  TRIAL_DAYS,
  createCompanyForUser,
} from "@/lib/create-company-service";
import {
  createPartnerSignupConversion,
  resolvePartnerFromAttribution,
} from "@/lib/partner-conversion-service";
import { readPartnerAttributionFromCookies } from "@/lib/partner-auth";
import {
  buildKvkkAcknowledgmentRecord,
  KVKK_AYDINLATMA_VERSION,
  MARKETING_CONSENT_TEXT,
  MARKETING_CONSENT_VERSION,
} from "@/lib/legal/kvkk-consent";
import { getTrustedClientIp } from "@/lib/payments/trusted-client-ip";

const registerSchema = z.object({
  name: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır."),
  email: z.string().email("Geçerli bir e-posta girin."),
  phone: z.string().optional(),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
  kvkkInformed: z.literal(true, {
    message: "KVKK aydınlatma metnini okuduğunuzu ve bilgilendirildiğinizi onaylamalısınız.",
  }),
  marketingConsent: z.boolean().optional(),

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
    const clientIp = getTrustedClientIp(req);
    const userAgent = req.headers.get("user-agent");

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

      await tx.userConsent.create({
        data: {
          userId: user.id,
          type: "KVKK",
          version: KVKK_AYDINLATMA_VERSION,
          consentText: buildKvkkAcknowledgmentRecord(),
          ip: clientIp,
          userAgent: userAgent?.slice(0, 500) ?? null,
        },
      });

      if (parsed.data.marketingConsent === true) {
        await tx.userConsent.create({
          data: {
            userId: user.id,
            type: "MARKETING_ELECTRONIC",
            version: MARKETING_CONSENT_VERSION,
            consentText: MARKETING_CONSENT_TEXT,
            ip: clientIp,
            userAgent: userAgent?.slice(0, 500) ?? null,
          },
        });
      }

      const finalCompanyName =
        wantsCompanyInfo && companyName?.trim()
          ? companyName.trim()
          : "İşletmem";

      const { company } = await createCompanyForUser(tx, {
        userId: user.id,
        name: finalCompanyName,
        taxNo: wantsCompanyInfo ? taxNo || null : null,
        taxOffice: wantsCompanyInfo ? taxOffice || null : null,
        phone: phone || null,
        email,
        source: "REGISTER",
        registerCompanyNameProvided: Boolean(
          wantsCompanyInfo && companyName?.trim()
        ),
      });

      return { user, company };
    });

    const attribution = await readPartnerAttributionFromCookies();
    const partner = await resolvePartnerFromAttribution({
      referralCode: attribution.referralCode,
    });

    if (partner && attribution.referralCode) {
      await createPartnerSignupConversion({
        companyId: result.company.id,
        userId: result.user.id,
        partnerId: partner.id,
        referralCode: attribution.referralCode,
        clickId: attribution.clickId,
        source: "COOKIE",
      });
    }

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
