import { z } from "zod";

export const createCompanyBodySchema = z.object({
  name: z.string().trim().min(1, "Firma adı zorunludur."),
  taxNo: z.string().optional(),
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Geçerli bir e-posta girin.").optional().or(z.literal("")),
  logoUrl: z.string().optional(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
});

export type CreateCompanyBody = z.infer<typeof createCompanyBodySchema>;

export type CompanyListItem = {
  companyId: string;
  companyName: string;
  role: string;
  roleLabel: string;
  isOwner: boolean;
  isActive: boolean;
  isCurrent: boolean;
  logoUrl?: string | null;
};

export function parseCreateCompanyBody(body: unknown) {
  return createCompanyBodySchema.safeParse(body);
}

export function normalizeCreateCompanyInput(parsed: CreateCompanyBody) {
  return {
    name: parsed.name.trim(),
    taxNo: (parsed.taxNo || parsed.taxNumber)?.trim() || null,
    taxOffice: parsed.taxOffice?.trim() || null,
    address: parsed.address?.trim() || null,
    phone: parsed.phone?.trim() || null,
    email: parsed.email?.trim() || null,
    logoUrl: parsed.logoUrl?.trim() || null,
    currency: parsed.currency ?? "TRY",
    defaultVatRate: parsed.defaultVatRate ?? 20,
  };
}

export function buildCreateCompanyResponse(company: { id: string; name: string }) {
  return {
    success: true as const,
    companyId: company.id,
    companyName: company.name,
  };
}

export function filterCompaniesBySearch(
  companies: CompanyListItem[],
  query: string
): CompanyListItem[] {
  const normalized = query.trim().toLocaleLowerCase("tr");

  if (!normalized) {
    return companies;
  }

  return companies.filter((company) => {
    const haystack = [
      company.companyName,
      company.roleLabel,
      company.isOwner ? "sahip" : "",
    ]
      .join(" ")
      .toLocaleLowerCase("tr");

    return haystack.includes(normalized);
  });
}

export function validateCreateCompanyWizardStep(
  step: number,
  form: { name: string; email: string }
): string | null {
  if (step === 1) {
    if (form.name.trim().length < 2) {
      return "Firma adı en az 2 karakter olmalıdır.";
    }
  }

  if (step === 2 && form.email.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Geçerli bir e-posta girin.";
    }
  }

  return null;
}
