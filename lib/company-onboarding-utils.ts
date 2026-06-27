import { isCompanyProfileComplete } from "@/lib/onboarding/onboarding-company-utils";

type CompanyOnboardingInput = {
  name: string | null | undefined;
};

/** @deprecated Dashboard checklist ve CompanyOnboarding state kullanın. */
export function shouldShowOnboardingAlert(
  company: CompanyOnboardingInput
): boolean {
  return !isCompanyProfileComplete(company.name);
}

export { isCompanyProfileComplete };
