import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedApiSession } from "@/lib/module-access";
import {
  AuthCompaniesError,
  switchUserCompany,
} from "@/lib/auth-companies-service";
import { attachAuthCookie } from "@/lib/auth-session-utils";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";
import { getPostAuthRedirectPath, resolveEffectiveRole } from "@/lib/permission-utils";

const switchCompanySchema = z.object({
  companyId: z.string().min(1, "Firma seçimi gerekli."),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedApiSession();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = switchCompanySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Firma seçimini kontrol edin.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const previousCompanyId = auth.session.companyId;

    const result = await switchUserCompany({
      userId: auth.session.userId,
      companyId: parsed.data.companyId,
    });

    if (previousCompanyId) {
      invalidateCompanyEntitlementCache(previousCompanyId);
    }
    invalidateCompanyEntitlementCache(result.companyId);

    const effectiveRole = resolveEffectiveRole({
      role: result.membershipRole,
      isOwner: result.isOwner,
    });

    const response = NextResponse.json({
      success: true,
      message: "Aktif firma güncellendi.",
      data: {
        companyId: result.companyId,
        companyName: result.companyName,
        redirectTo: getPostAuthRedirectPath(effectiveRole, result.isOwner),
      },
    });

    await attachAuthCookie(response, {
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      companyId: result.companyId,
      sv: result.user.sessionVersion,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings/billing");

    return response;
  } catch (error) {
    if (error instanceof AuthCompaniesError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("AUTH_SWITCH_COMPANY_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Firma değiştirilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
