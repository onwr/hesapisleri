import { NextResponse } from "next/server";
import {
  getOnboardingBundle,
  startCompanyOnboarding,
} from "@/lib/onboarding/onboarding-service";
import {
  handleOnboardingApiError,
  requireOnboardingApiContext,
} from "@/lib/onboarding/onboarding-api";

export async function GET() {
  try {
    const auth = await requireOnboardingApiContext();
    if ("error" in auth) return auth.error;

    const bundle = await getOnboardingBundle(auth.actor);

    if (bundle.state.status === "NOT_STARTED" && bundle.canManage) {
      await startCompanyOnboarding(auth.actor);
      const refreshed = await getOnboardingBundle(auth.actor);
      return NextResponse.json({ success: true, data: refreshed });
    }

    return NextResponse.json({ success: true, data: bundle });
  } catch (error) {
    return handleOnboardingApiError(error);
  }
}
