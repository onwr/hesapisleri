import "server-only";

import type { PlatformSettings } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/prisma";
import { AdminPlatformSettingsServiceError } from "@/lib/admin/platform-settings/platform-settings-errors";
import {
  PLATFORM_SETTINGS_DEFAULTS,
  PLATFORM_SETTINGS_ID,
} from "@/lib/admin/platform-settings/platform-settings-defaults";

export type SerializedPlatformSettings = {
  id: string;
  version: number;
  brandName: string;
  supportEmail: string;
  supportPhone: string | null;
  websiteUrl: string;
  registrationEnabled: boolean;
  trialDays: number;
  trialAmount: number;
  defaultCurrency: string;
  defaultVatRate: number;
  defaultNotifyLowStock: boolean;
  defaultNotifyDueInvoices: boolean;
  defaultNotifyLateCollections: boolean;
  defaultNotifyDailySummary: boolean;
  defaultNotifyEmployeePayments: boolean;
  maxImageBytes: number;
  maxTaxCertificateBytes: number;
  sessionMaxAgeDays: number;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  updatedAt: string;
};

export function serializePlatformSettings(row: PlatformSettings): SerializedPlatformSettings {
  return {
    id: row.id,
    version: row.version,
    brandName: row.brandName,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    websiteUrl: row.websiteUrl,
    registrationEnabled: row.registrationEnabled,
    trialDays: row.trialDays,
    trialAmount: Number(row.trialAmount),
    defaultCurrency: row.defaultCurrency,
    defaultVatRate: row.defaultVatRate,
    defaultNotifyLowStock: row.defaultNotifyLowStock,
    defaultNotifyDueInvoices: row.defaultNotifyDueInvoices,
    defaultNotifyLateCollections: row.defaultNotifyLateCollections,
    defaultNotifyDailySummary: row.defaultNotifyDailySummary,
    defaultNotifyEmployeePayments: row.defaultNotifyEmployeePayments,
    maxImageBytes: row.maxImageBytes,
    maxTaxCertificateBytes: row.maxTaxCertificateBytes,
    sessionMaxAgeDays: row.sessionMaxAgeDays,
    maintenanceMode: row.maintenanceMode,
    maintenanceMessage: row.maintenanceMessage,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeSettingsSnapshot(row: PlatformSettings) {
  const serialized = serializePlatformSettings(row);
  const { id: _id, updatedAt: _updatedAt, ...snapshot } = serialized;
  return snapshot;
}

export async function assertPlatformSettingsSingleton() {
  const count = await db.platformSettings.count();
  if (count > 1) {
    throw new AdminPlatformSettingsServiceError(
      "Birden fazla platform ayar kaydı bulundu.",
      409,
      "PLATFORM_SETTINGS_SINGLETON_CONFLICT"
    );
  }
}

export async function ensurePlatformSettingsRow() {
  await assertPlatformSettingsSingleton();

  const existing = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (existing) return existing;

  return db.platformSettings.create({
    data: { id: PLATFORM_SETTINGS_ID },
  });
}

async function loadPlatformSettingsUncached(): Promise<SerializedPlatformSettings> {
  const row = await ensurePlatformSettingsRow();
  return serializePlatformSettings(row);
}

const getCachedPlatformSettings = unstable_cache(
  loadPlatformSettingsUncached,
  ["platform-settings-loader"],
  { revalidate: 20, tags: ["platform-settings"] }
);

export async function getPlatformSettings(): Promise<SerializedPlatformSettings> {
  return getCachedPlatformSettings();
}

export async function getPlatformUploadLimits() {
  const settings = await getPlatformSettings();
  return {
    maxImageBytes: settings.maxImageBytes,
    maxTaxCertificateBytes: settings.maxTaxCertificateBytes,
  };
}

export async function getSessionMaxAgeDays() {
  const settings = await getPlatformSettings();
  return settings.sessionMaxAgeDays;
}

export async function getNewCompanyDefaults() {
  const settings = await getPlatformSettings();
  return {
    currency: settings.defaultCurrency,
    defaultVatRate: settings.defaultVatRate,
    trialDays: settings.trialDays,
    trialAmount: settings.trialAmount,
    notifyLowStock: settings.defaultNotifyLowStock,
    notifyDueInvoices: settings.defaultNotifyDueInvoices,
    notifyLateCollections: settings.defaultNotifyLateCollections,
    notifyDailySummary: settings.defaultNotifyDailySummary,
    notifyEmployeePayments: settings.defaultNotifyEmployeePayments,
  };
}

export async function assertRegistrationEnabled() {
  const settings = await getPlatformSettings();
  if (!settings.registrationEnabled) {
    const { RegistrationDisabledError } = await import(
      "@/lib/admin/platform-settings/platform-settings-errors"
    );
    throw new RegistrationDisabledError();
  }
}

export function getPlatformBrandingFromSettings(
  settings: SerializedPlatformSettings
) {
  return {
    brandName: settings.brandName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    website: settings.websiteUrl,
  };
}

/** Fallback when DB unavailable in non-server contexts */
export function getPlatformSettingsFallback(): SerializedPlatformSettings {
  return {
    id: PLATFORM_SETTINGS_ID,
    version: 1,
    ...PLATFORM_SETTINGS_DEFAULTS,
    updatedAt: new Date(0).toISOString(),
  };
}
