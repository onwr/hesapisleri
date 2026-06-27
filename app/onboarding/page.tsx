import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { requireCompanyUser } from "@/lib/auth/auth-dal";
import { getOrCreateCompanyOnboarding } from "@/lib/onboarding";

export default async function OnboardingPage() {
  const session = await requireCompanyUser();
  const state = await getOrCreateCompanyOnboarding(session.company.id);

  if (
    state.status === "COMPLETED" ||
    state.status === "DISMISSED" ||
    session.isSuperAdmin
  ) {
    redirect("/dashboard");
  }

  return (
    <AuthShell variant="onboarding" maxWidth="xl">
      <OnboardingForm />
    </AuthShell>
  );
}
