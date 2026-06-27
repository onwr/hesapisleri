import "server-only";

import { unstable_cache } from "next/cache";
import { getPlatformSettings } from "@/lib/admin/platform-settings/platform-settings-loader";
import { getPublicPlatformRuntimeConfigFallback } from "@/lib/platform-runtime/platform-runtime-fallback";
import type {
  PlatformUploadLimits,
  PublicPlatformRuntimeConfig,
} from "@/lib/platform-runtime/platform-runtime-types";

function toPublicRuntimeConfig(
  settings: Awaited<ReturnType<typeof getPlatformSettings>>
): PublicPlatformRuntimeConfig {
  return {
    maxImageBytes: settings.maxImageBytes,
    maxTaxCertificateBytes: settings.maxTaxCertificateBytes,
    brandName: settings.brandName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    websiteUrl: settings.websiteUrl,
    registrationEnabled: settings.registrationEnabled,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
  };
}

export { getPublicPlatformRuntimeConfigFallback } from "@/lib/platform-runtime/platform-runtime-fallback";

const getCachedPublicRuntimeConfig = unstable_cache(
  async () => toPublicRuntimeConfig(await getPlatformSettings()),
  ["platform-runtime-public"],
  { revalidate: 20, tags: ["platform-runtime-public", "platform-settings"] }
);

export async function getPublicPlatformRuntimeConfig(): Promise<PublicPlatformRuntimeConfig> {
  try {
    return await getCachedPublicRuntimeConfig();
  } catch {
    return getPublicPlatformRuntimeConfigFallback();
  }
}

const getCachedUploadLimits = unstable_cache(
  async (): Promise<PlatformUploadLimits> => {
    const settings = await getPlatformSettings();
    return {
      maxImageBytes: settings.maxImageBytes,
      maxTaxCertificateBytes: settings.maxTaxCertificateBytes,
    };
  },
  ["platform-runtime-upload-limits"],
  { revalidate: 20, tags: ["platform-runtime-upload", "platform-settings"] }
);

export async function getPlatformRuntimeUploadLimits(): Promise<PlatformUploadLimits> {
  try {
    return await getCachedUploadLimits();
  } catch {
    const fallback = getPublicPlatformRuntimeConfigFallback();
    return {
      maxImageBytes: fallback.maxImageBytes,
      maxTaxCertificateBytes: fallback.maxTaxCertificateBytes,
    };
  }
}
