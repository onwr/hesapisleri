import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  assertRegistrationEnabled,
  getNewCompanyDefaults,
  RegistrationDisabledError,
} from "@/lib/admin/platform-settings";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import { createCompanyForUser } from "@/lib/create-company-service";
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
import { buildZodValidationErrorBody } from "@/lib/api-zod-validation";
import { registerSchema, REGISTER_FIELD_ERROR_MESSAGES } from "@/lib/auth/register-schema";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-transaction-utils";

export async function POST(req: Request) {
  try {
    await assertRegistrationEnabled();

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildZodValidationErrorBody(parsed.error), {
        status: 400,
      });
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
          message: REGISTER_FIELD_ERROR_MESSAGES.emailTaken,
          errors: { email: [REGISTER_FIELD_ERROR_MESSAGES.emailTaken] },
        },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const clientIp = getTrustedClientIp(req);
    const userAgent = req.headers.get("user-agent");

    const platformDefaults = await getNewCompanyDefaults();

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "OWNER",
          status: "ACTIVE",
          loginTrackingStatus: "NEVER_LOGGED_IN",
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
        platformDefaults,
      });

      return { user, company };
    });

    const attribution = await readPartnerAttributionFromCookies();
    const referralCode =
      attribution.referralCode ??
      parsed.data.referralCode?.trim() ??
      null;
    const partner = await resolvePartnerFromAttribution({
      referralCode,
    });

    if (partner && referralCode) {
      await createPartnerSignupConversion({
        companyId: result.company.id,
        userId: result.user.id,
        partnerId: partner.id,
        referralCode: partner.referralCode,
        clickId: attribution.clickId,
        source: attribution.referralCode ? "COOKIE" : "REFERRAL_CODE",
      });
    }

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
        trialDays: platformDefaults.trialDays,
      },
    });

    await attachAuthCookie(response, {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.company.id,
      sv: result.user.sessionVersion,
    });

    return response;
  } catch (error) {
    if (error instanceof RegistrationDisabledError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status }
      );
    }

    // Eşzamanlı iki register isteği aynı e-posta ile yarışırsa (double
    // submit / iki sekme), DB unique constraint bunu yakalar — genel 500
    // yerine aynı açık duplicate mesajını döner.
    if (isPrismaUniqueConstraintError(error, "email")) {
      return NextResponse.json(
        {
          success: false,
          message: REGISTER_FIELD_ERROR_MESSAGES.emailTaken,
          errors: { email: [REGISTER_FIELD_ERROR_MESSAGES.emailTaken] },
        },
        { status: 409 }
      );
    }

    console.error("REGISTER_ERROR", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: "Kayıt oluşturulurken bir hata oluştu.",
      },
      { status: 500 }
    );
  }
}
