const DEFAULT_COMPANY_NAME = "İşletmem";

type CompanyOnboardingInput = {
  name: string | null | undefined;
};

/** Vergi no zorunlu değil; yalnızca varsayılan firma adı kaldıysa uyarı gösterilir. */
export function shouldShowOnboardingAlert(
  company: CompanyOnboardingInput
): boolean {
  const name = company.name?.trim() ?? "";
  return name.length < 2 || name === DEFAULT_COMPANY_NAME;
}
