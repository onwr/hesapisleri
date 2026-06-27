export { AdminPlatformSettingsServiceError, MaintenanceModeActiveError, RegistrationDisabledError } from "@/lib/admin/platform-settings/platform-settings-errors";
export {
  adminPlatformSettingsUpdateSchema,
  assertNoForbiddenPlatformSettingsKeys,
} from "@/lib/admin/platform-settings/platform-settings-schemas";
export {
  PLATFORM_SETTINGS_ID,
  PLATFORM_SETTINGS_DEFAULTS,
  SETTINGS_FIELD_KEYS,
  CRITICAL_SETTINGS_FIELDS,
} from "@/lib/admin/platform-settings/platform-settings-defaults";
export {
  redactSettingsAuditValue,
  buildSafeSettingsDiff,
} from "@/lib/admin/platform-settings/platform-settings-privacy";
export { invalidateAdminPlatformSettingsCaches } from "@/lib/admin/platform-settings/platform-settings-cache";
export {
  logAdminPlatformSettingsAudit,
  buildStructuredPlatformSettingsActivityWhere,
  resolvePlatformSettingsAuditActions,
} from "@/lib/admin/platform-settings/platform-settings-audit-service";
export {
  getPlatformSettings,
  getPlatformUploadLimits,
  getSessionMaxAgeDays,
  getNewCompanyDefaults,
  assertRegistrationEnabled,
  getPlatformBrandingFromSettings,
  getPlatformSettingsFallback,
  serializePlatformSettings,
  serializeSettingsSnapshot,
  ensurePlatformSettingsRow,
  assertPlatformSettingsSingleton,
} from "@/lib/admin/platform-settings/platform-settings-loader";
export {
  assertPlatformAvailable,
  assertNotInMaintenanceForUser,
  redirectIfMaintenanceActive,
  getPublicPlatformRuntimeConfig,
  getPlatformRuntimeUploadLimits,
  invalidatePlatformRuntimeCaches,
  isMaintenanceExemptApi,
  isMaintenanceExemptPage,
} from "@/lib/platform-runtime";
export { getPlatformEnvironmentStatus } from "@/lib/admin/platform-settings/platform-environment-service";
export {
  getAdminPlatformSettings,
  listPlatformSettingsHistory,
  getAdminPlatformEnvironment,
} from "@/lib/admin/platform-settings/settings-query-service";
export { updateAdminPlatformSettings } from "@/lib/admin/platform-settings/settings-mutation-service";
