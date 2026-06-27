import { NextResponse } from "next/server";
import { reopenCompanyOnboarding } from "@/lib/onboarding/onboarding-service";
import {
  handleOnboardingApiError,
  requireOnboardingApiContext,
} from "@/lib/onboarding/onboarding-api";

export async function POST() {
  try {
    const auth = await requireOnboardingApiContext();
    if ("error" in auth) return auth.error;

    const state = await reopenCompanyOnboarding(auth.actor);

    return NextResponse.json({
      success: true,
      message: "Onboarding yeniden açıldı.",
      data: { state },
    });
  } catch (error) {
    return handleOnboardingApiError(error);
  }
}
