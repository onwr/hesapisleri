import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";

/** Tüzel kişilik bilgileri — platform markasından bağımsız, hukukçu doğrulaması gerekir. */
export const COMPANY_LEGAL_STATIC = {
  tradeName: "TAMPAZAR ELEKTRONİK TİCARET SANAYİ LTD. ŞTİ.",
  address: "Altınordu/ORDU/TÜRKIYE",
  kepAddress: null as string | null,
} as const;

/** Senkron fallback — istemci bileşenleri ve kayıt akışı için. */
export const COMPANY_LEGAL_INFO = {
  ...COMPANY_LEGAL_STATIC,
  brandName: PLATFORM_SETTINGS_DEFAULTS.brandName,
  kvkkEmail: PLATFORM_SETTINGS_DEFAULTS.supportEmail,
  phone: PLATFORM_SETTINGS_DEFAULTS.supportPhone ?? "",
  website: PLATFORM_SETTINGS_DEFAULTS.websiteUrl,
} as const;

export type CompanyLegalInfo = {
  tradeName: string;
  brandName: string;
  address: string;
  kvkkEmail: string;
  phone: string;
  kepAddress: string | null;
  website: string;
};

export function getPlatformLegalInfoFallback(): CompanyLegalInfo {
  return { ...COMPANY_LEGAL_INFO };
}
