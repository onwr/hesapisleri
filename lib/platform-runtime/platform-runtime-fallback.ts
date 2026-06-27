import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import type { PublicPlatformRuntimeConfig } from "@/lib/platform-runtime/platform-runtime-types";

export function getPublicPlatformRuntimeConfigFallback(): PublicPlatformRuntimeConfig {
  return {
    maxImageBytes: PLATFORM_SETTINGS_DEFAULTS.maxImageBytes,
    maxTaxCertificateBytes: PLATFORM_SETTINGS_DEFAULTS.maxTaxCertificateBytes,
    brandName: PLATFORM_SETTINGS_DEFAULTS.brandName,
    supportEmail: PLATFORM_SETTINGS_DEFAULTS.supportEmail,
    supportPhone: PLATFORM_SETTINGS_DEFAULTS.supportPhone,
    websiteUrl: PLATFORM_SETTINGS_DEFAULTS.websiteUrl,
    registrationEnabled: PLATFORM_SETTINGS_DEFAULTS.registrationEnabled,
    maintenanceMode: PLATFORM_SETTINGS_DEFAULTS.maintenanceMode,
    maintenanceMessage: PLATFORM_SETTINGS_DEFAULTS.maintenanceMessage,
  };
}
