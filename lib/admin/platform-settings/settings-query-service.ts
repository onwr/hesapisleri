import "server-only";

import { db } from "@/lib/prisma";
import { AdminPlatformSettingsServiceError } from "@/lib/admin/platform-settings/platform-settings-errors";
import {
  buildStructuredPlatformSettingsActivityWhere,
  logAdminPlatformSettingsAudit,
  resolvePlatformSettingsAuditActions,
} from "@/lib/admin/platform-settings/platform-settings-audit-service";
import { redactSettingsAuditValue } from "@/lib/admin/platform-settings/platform-settings-privacy";
import {
  SETTINGS_FIELD_KEYS,
  PLATFORM_SETTINGS_ID,
} from "@/lib/admin/platform-settings/platform-settings-defaults";
import {
  assertPlatformSettingsSingleton,
  ensurePlatformSettingsRow,
  getPlatformSettings,
  serializePlatformSettings,
  serializeSettingsSnapshot,
} from "@/lib/admin/platform-settings/platform-settings-loader";
import { getPlatformEnvironmentStatus } from "@/lib/admin/platform-settings/platform-environment-service";

export async function getAdminPlatformSettings() {
  await assertPlatformSettingsSingleton();
  const settings = await getPlatformSettings();

  return {
    settings,
    policyNotes: {
      historicalData:
        "Ayar değişiklikleri yalnız gelecekteki işlemlere uygulanır; mevcut abonelik, ödeme, trial ve dosyalar değişmez.",
      registration:
        "Kayıt kapatıldığında mevcut kullanıcılar etkilenmez; yalnız yeni public register engellenir.",
      maintenance:
        "Bakım modunda Super Admin erişimi devam eder; API/cron/callback route'ları engellenmez.",
    },
  };
}

export async function listPlatformSettingsHistory(limit = 20) {
  await assertPlatformSettingsSingleton();

  const rows = await db.activityLog.findMany({
    where: buildStructuredPlatformSettingsActivityWhere(),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return rows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const changedFields = Array.isArray(meta.changedFields)
      ? (meta.changedFields as string[])
      : [];
    const reason = typeof meta.reason === "string" ? meta.reason : null;
    const versionBefore =
      typeof meta.versionBefore === "number" ? meta.versionBefore : null;
    const versionAfter = typeof meta.versionAfter === "number" ? meta.versionAfter : null;

    return {
      id: row.id,
      action: row.action,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      reason,
      changedFields,
      versionBefore,
      versionAfter,
      user: row.user
        ? { id: row.user.id, name: row.user.name, email: row.user.email }
        : null,
      diff: redactSettingsAuditValue("diff", meta.diff),
    };
  });
}

export async function getAdminPlatformEnvironment() {
  return getPlatformEnvironmentStatus();
}

export { SETTINGS_FIELD_KEYS };
