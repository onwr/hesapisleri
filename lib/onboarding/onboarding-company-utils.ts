const DEFAULT_COMPANY_NAME = "İşletmem";

export function isCompanyProfileComplete(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? "";
  return trimmed.length >= 2 && trimmed !== DEFAULT_COMPANY_NAME;
}
