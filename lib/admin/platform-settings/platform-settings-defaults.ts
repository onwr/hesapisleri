export const PLATFORM_SETTINGS_ID = "default";

export const PLATFORM_SETTINGS_DEFAULTS = {
  brandName: "Hesap İşleri",
  supportEmail: "destek@hesapisleri.com",
  supportPhone: null as string | null,
  websiteUrl: "https://hesapisleri.com",
  registrationEnabled: true,
  trialDays: 14,
  trialAmount: 1499,
  defaultCurrency: "TRY",
  defaultVatRate: 20,
  defaultNotifyLowStock: true,
  defaultNotifyDueInvoices: true,
  defaultNotifyLateCollections: true,
  defaultNotifyDailySummary: false,
  defaultNotifyEmployeePayments: true,
  maxImageBytes: 5 * 1024 * 1024,
  maxTaxCertificateBytes: 5 * 1024 * 1024,
  sessionMaxAgeDays: 7,
  maintenanceMode: false,
  maintenanceMessage: null as string | null,
} as const;

export const SETTINGS_FIELD_KEYS = [
  "brandName",
  "supportEmail",
  "supportPhone",
  "websiteUrl",
  "registrationEnabled",
  "trialDays",
  "trialAmount",
  "defaultCurrency",
  "defaultVatRate",
  "defaultNotifyLowStock",
  "defaultNotifyDueInvoices",
  "defaultNotifyLateCollections",
  "defaultNotifyDailySummary",
  "defaultNotifyEmployeePayments",
  "maxImageBytes",
  "maxTaxCertificateBytes",
  "sessionMaxAgeDays",
  "maintenanceMode",
  "maintenanceMessage",
] as const;

export type PlatformSettingsFieldKey = (typeof SETTINGS_FIELD_KEYS)[number];

export const CRITICAL_SETTINGS_FIELDS = new Set<PlatformSettingsFieldKey>([
  "registrationEnabled",
  "maintenanceMode",
  "trialDays",
  "maxImageBytes",
  "maxTaxCertificateBytes",
  "sessionMaxAgeDays",
  "defaultVatRate",
]);
