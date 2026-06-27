import { NextResponse } from "next/server";
import { requireApiModuleAccess } from "@/lib/module-access";
import { resolveEffectiveRole } from "@/lib/permission-utils";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";
import { OnboardingServiceError } from "@/lib/onboarding/onboarding-service";

export async function requireOnboardingApiContext() {
  const auth = await requireApiModuleAccess("dashboard");
  if ("error" in auth) {
    return { error: auth.error } as const;
  }

  const effectiveRole = resolveEffectiveRole({
    role: auth.session.companyUser.role,
    isOwner: auth.session.companyUser.isOwner,
  });

  return {
    actor: {
      userId: auth.userId,
      companyId: auth.companyId,
      effectiveRole,
      isOwner: auth.session.companyUser.isOwner,
      isSuperAdmin: isPlatformSuperAdminUser(auth.session.user),
    },
  } as const;
}

export function handleOnboardingApiError(error: unknown) {
  if (error instanceof OnboardingServiceError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
      },
      { status: error.status }
    );
  }

  console.error("ONBOARDING_API_ERROR", error);
  return NextResponse.json(
    { success: false, message: "Onboarding işlemi tamamlanamadı." },
    { status: 500 }
  );
}
