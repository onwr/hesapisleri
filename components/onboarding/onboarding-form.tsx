"use client";

import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

export function OnboardingForm() {
  return (
    <Suspense fallback={<AppLoadingScreen preset="onboarding" />}>
      <OnboardingWizard />
    </Suspense>
  );
}
