import type { CompanyOnboarding } from "@prisma/client";

export function shouldForceOnboardingRedirect(
  state: Pick<CompanyOnboarding, "status">,
  isSuperAdmin: boolean
): boolean {
  if (isSuperAdmin) return false;
  return state.status === "NOT_STARTED" || state.status === "IN_PROGRESS";
}

export function resolveOnboardingRedirectPath(
  state: Pick<CompanyOnboarding, "status" | "currentStep">,
  isSuperAdmin: boolean
): string | null {
  if (!shouldForceOnboardingRedirect(state, isSuperAdmin)) {
    return null;
  }

  if (state.currentStep > 1) {
    return `/onboarding?step=${state.currentStep}`;
  }

  return "/onboarding";
}
