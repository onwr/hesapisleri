import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPlatformSettingsServiceError } from "@/lib/admin/platform-settings/platform-settings-errors";
import {
  logAdminPlatformSettingsAudit,
  resolvePlatformSettingsAuditActions,
} from "@/lib/admin/platform-settings/platform-settings-audit-service";
import { invalidateAdminPlatformSettingsCaches } from "@/lib/admin/platform-settings/platform-settings-cache";
import { buildSafeSettingsDiff } from "@/lib/admin/platform-settings/platform-settings-privacy";
import {
  adminPlatformSettingsUpdateSchema,
  assertNoForbiddenPlatformSettingsKeys,
} from "@/lib/admin/platform-settings/platform-settings-schemas";
import {
  SETTINGS_FIELD_KEYS,
  PLATFORM_SETTINGS_ID,
} from "@/lib/admin/platform-settings/platform-settings-defaults";
import {
  assertPlatformSettingsSingleton,
  serializeSettingsSnapshot,
} from "@/lib/admin/platform-settings/platform-settings-loader";
import { getAdminPlatformSettings } from "@/lib/admin/platform-settings/settings-query-service";

async function ensurePlatformSettingsRowInTx(tx: Prisma.TransactionClient) {
  const existing = await tx.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (existing) {
    return { row: existing, created: false };
  }

  const row = await tx.platformSettings.create({
    data: { id: PLATFORM_SETTINGS_ID },
  });

  return { row, created: true };
}

export async function updateAdminPlatformSettings(
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenPlatformSettingsKeys(body);
  const parsed = adminPlatformSettingsUpdateSchema.parse(body);

  const { reason, confirm: _confirm, version, ...updates } = parsed;
  if (!Object.keys(updates).length) {
    throw new AdminPlatformSettingsServiceError("Güncellenecek alan belirtilmedi.", 400);
  }

  let rowCreated = false;

  await db.$transaction(async (tx) => {
    await assertPlatformSettingsSingleton();

    const ensured = await ensurePlatformSettingsRowInTx(tx);
    rowCreated = ensured.created;
    const beforeRow = ensured.row;
    const before = serializeSettingsSnapshot(beforeRow);

    const result = await tx.platformSettings.updateMany({
      where: { id: PLATFORM_SETTINGS_ID, version },
      data: {
        ...updates,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new AdminPlatformSettingsServiceError(
        "Platform ayarları başka bir işlem tarafından güncellendi.",
        409,
        "PLATFORM_SETTINGS_VERSION_CONFLICT"
      );
    }

    await tx.platformSettings.update({
      where: { id: PLATFORM_SETTINGS_ID },
      data: { updatedByUserId: actorUserId },
    });

    const afterRow = await tx.platformSettings.findUniqueOrThrow({
      where: { id: PLATFORM_SETTINGS_ID },
    });
    const after = serializeSettingsSnapshot(afterRow);

    const changedFields = SETTINGS_FIELD_KEYS.filter(
      (key) => before[key] !== after[key]
    );

    if (!changedFields.length) {
      throw new AdminPlatformSettingsServiceError("Değişiklik algılanmadı.", 400);
    }

    const diff = buildSafeSettingsDiff(
      before as Record<string, unknown>,
      after as Record<string, unknown>
    );

    const actions = resolvePlatformSettingsAuditActions(
      {
        registrationEnabled: before.registrationEnabled,
        maintenanceMode: before.maintenanceMode,
      },
      {
        registrationEnabled: after.registrationEnabled,
        maintenanceMode: after.maintenanceMode,
      }
    );

    if (rowCreated) {
      actions.unshift("PLATFORM_SETTINGS_CREATED");
    }

    for (const action of actions) {
      await logAdminPlatformSettingsAudit({
        userId: actorUserId,
        action,
        displayMessage:
          action === "PLATFORM_SETTINGS_CREATED"
            ? "Platform ayarları kaydı oluşturuldu."
            : `Platform ayarları güncellendi: ${changedFields.join(", ")}`,
        metadata: {
          reason,
          changedFields,
          diff,
          versionBefore: version,
          versionAfter: afterRow.version,
        },
        tx,
      });
    }
  });

  invalidateAdminPlatformSettingsCaches();
  return getAdminPlatformSettings();
}
