"use client";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function OnboardingPage() {
  return (
    <AuthShell variant="onboarding" maxWidth="xl">
      <OnboardingForm />
    </AuthShell>
  );
}
