import type { Company, CompanySettings } from "@prisma/client";

export type SerializedCompany = Omit<Company, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type SerializedCompanySettings = Omit<
  CompanySettings,
  | "monthlyFee"
  | "lastPaymentDate"
  | "nextPaymentDate"
  | "createdAt"
  | "updatedAt"
> & {
  monthlyFee: number;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeCompany(company: Company): SerializedCompany {
  return {
    ...company,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export function serializeCompanySettings(
  settings: CompanySettings
): SerializedCompanySettings {
  return {
    ...settings,
    monthlyFee: Number(settings.monthlyFee),
    lastPaymentDate: settings.lastPaymentDate?.toISOString() ?? null,
    nextPaymentDate: settings.nextPaymentDate?.toISOString() ?? null,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}
