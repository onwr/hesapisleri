import { NextResponse } from "next/server";
import {
  dismissOnboardingChecklist,
  reopenOnboardingChecklist,
} from "@/lib/onboarding/onboarding-service";
import {
  handleOnboardingApiError,
  requireOnboardingApiContext,
} from "@/lib/onboarding/onboarding-api";

export async function POST(req: Request) {
  try {
    const auth = await requireOnboardingApiContext();
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const state =
      body.action === "reopen"
        ? await reopenOnboardingChecklist(auth.actor)
        : await dismissOnboardingChecklist(auth.actor);

    return NextResponse.json({
      success: true,
      data: { state },
    });
  } catch (error) {
    return handleOnboardingApiError(error);
  }
}
