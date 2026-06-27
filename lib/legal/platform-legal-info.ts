import "server-only";

import { unstable_cache } from "next/cache";
import { getPlatformSettings } from "@/lib/admin/platform-settings/platform-settings-loader";
import {
  COMPANY_LEGAL_STATIC,
  getPlatformLegalInfoFallback,
  type CompanyLegalInfo,
} from "@/lib/legal/company-legal-info";

export type PlatformLegalInfo = CompanyLegalInfo;

export { getPlatformLegalInfoFallback } from "@/lib/legal/company-legal-info";

function buildLegalInfoFromSettings(
  settings: Awaited<ReturnType<typeof getPlatformSettings>>
): PlatformLegalInfo {
  return {
    ...COMPANY_LEGAL_STATIC,
    brandName: settings.brandName,
    kvkkEmail: settings.supportEmail,
    phone: settings.supportPhone ?? "",
    website: settings.websiteUrl,
  };
}

const getCachedPlatformLegalInfo = unstable_cache(
  async () => buildLegalInfoFromSettings(await getPlatformSettings()),
  ["platform-runtime-legal"],
  { revalidate: 20, tags: ["platform-runtime-legal", "platform-settings"] }
);

/** KVKK sayfası ve kayıt formu için canonical legal info loader. */
export async function getPlatformLegalInfo(): Promise<PlatformLegalInfo> {
  try {
    return await getCachedPlatformLegalInfo();
  } catch {
    return getPlatformLegalInfoFallback();
  }
}
