import { NextResponse } from "next/server";
import { requireAuthenticatedApiSession } from "@/lib/module-access";
import {
  AuthCompaniesError,
  listUserCompanies,
} from "@/lib/auth-companies-service";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import {
  buildCreateCompanyResponse,
  normalizeCreateCompanyInput,
  parseCreateCompanyBody,
} from "@/lib/create-company-api-utils";
import { createCompanyForUserInTransaction } from "@/lib/create-company-service";
import { db } from "@/lib/prisma";

export async function GET() {
  try {
    const auth = await requireAuthenticatedApiSession();
    if ("error" in auth) return auth.error;

    const data = await listUserCompanies(
      auth.session.userId,
      auth.session.companyId
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof AuthCompaniesError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("AUTH_COMPANIES_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firmalar yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedApiSession();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = parseCreateCompanyBody(body);

    if (!parsed.success) {
      const nameError = parsed.error.flatten().fieldErrors.name?.[0];

      return NextResponse.json(
        {
          success: false,
          message: nameError ?? "Firma bilgilerini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = normalizeCreateCompanyInput(parsed.data);

    if (input.name.length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: "Firma adı en az 2 karakter olmalıdır.",
        },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: auth.session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı bulunamadı." },
        { status: 401 }
      );
    }

    const referenceCompanyId = auth.session.companyId;
    const { getCompanyUsageSummary } = await import(
      "@/lib/billing/usage/usage-query-service"
    );
    const { getResolvedLimit } = await import(
      "@/lib/billing/entitlements/entitlement-resolution-service"
    );
    const usage = referenceCompanyId
      ? await getCompanyUsageSummary(referenceCompanyId, {
          userId: auth.session.userId,
        })
      : { MAX_COMPANIES: await db.companyUser.count({
          where: { userId: auth.session.userId, status: "ACTIVE" },
        }) };
    if (referenceCompanyId) {
      const limit = await getResolvedLimit(referenceCompanyId, "MAX_COMPANIES", {
        userId: auth.session.userId,
      });
      if (limit && !limit.isUnlimited && limit.value != null && usage.MAX_COMPANIES != null) {
        if (usage.MAX_COMPANIES >= limit.value) {
          return NextResponse.json(
            {
              success: false,
              message: `Firma limitine ulaşıldı (${usage.MAX_COMPANIES}/${limit.value}).`,
            },
            { status: 409 }
          );
        }
      }
    }

    const { company } = await createCompanyForUserInTransaction({
      userId: user.id,
      name: input.name,
      taxNo: input.taxNo,
      taxOffice: input.taxOffice,
      address: input.address,
      phone: input.phone,
      email: input.email ?? user.email,
      logoUrl: input.logoUrl,
      currency: input.currency,
      defaultVatRate: input.defaultVatRate,
      source: "NEW_COMPANY",
    });

    const response = NextResponse.json(
      buildCreateCompanyResponse(company),
      { status: 201 }
    );

    attachAuthCookie(response, {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: company.id,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthCompaniesError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("AUTH_COMPANIES_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firma oluşturulurken bir hata oluştu." },
      { status: 500 }
    );
  }
}
