import { NextResponse } from "next/server";
import { onboardingProgressPatchSchema } from "@/lib/onboarding/onboarding-schemas";
import {
  ensureCompanyOperationalDefaults,
  updateOnboardingProgress,
} from "@/lib/onboarding/onboarding-service";
import {
  handleOnboardingApiError,
  requireOnboardingApiContext,
} from "@/lib/onboarding/onboarding-api";

export async function PATCH(req: Request) {
  try {
    const auth = await requireOnboardingApiContext();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = onboardingProgressPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz onboarding adımı.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    if (parsed.data.currentStep >= 3) {
      await ensureCompanyOperationalDefaults(auth.actor.companyId);
    }

    const state = await updateOnboardingProgress(auth.actor, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Onboarding adımı güncellendi.",
      data: { state },
    });
  } catch (error) {
    return handleOnboardingApiError(error);
  }
}
