import "server-only";

import { db } from "@/lib/prisma";
import { AdminPartnerSettingsServiceError } from "@/lib/admin/partner-settings/admin-partner-settings-errors";
import {
  PARTNER_SETTINGS_ID,
  logAdminPartnerSettingsAudit,
  resolveSettingsAuditActions,
} from "@/lib/admin/partner-settings/admin-partner-settings-audit-service";
import { invalidateAdminPartnerSettingsCaches } from "@/lib/admin/partner-settings/admin-partner-settings-cache";
import { buildSafeSettingsDiff } from "@/lib/admin/partner-settings/admin-partner-settings-privacy";
import {
  adminPartnerSettingsUpdateSchema,
  assertNoForbiddenPartnerSettingsKeys,
} from "@/lib/admin/partner-settings/admin-partner-settings-schemas";
import {
  SETTINGS_FIELD_KEYS,
  getAdminPartnerSettings,
  serializeSettingsSnapshot,
} from "@/lib/admin/partner-settings/settings-query-service";

async function assertSettingsSingleton(tx: Pick<typeof db, "partnerSettings">) {
  const count = await tx.partnerSettings.count();
  if (count > 1) {
    throw new AdminPartnerSettingsServiceError(
      "Birden fazla partner ayar kaydı bulundu.",
      409,
      "SETTINGS_SINGLETON_CONFLICT"
    );
  }
}

export async function updateAdminPartnerSettings(
  actorUserId: string,
  body: Record<string, unknown>
) {
  assertNoForbiddenPartnerSettingsKeys(body);
  const parsed = adminPartnerSettingsUpdateSchema.parse(body);

  const { reason, confirm: _confirm, ...updates } = parsed;
  if (!Object.keys(updates).length) {
    throw new AdminPartnerSettingsServiceError("Güncellenecek alan belirtilmedi.", 400);
  }

  await db.$transaction(async (tx) => {
    await assertSettingsSingleton(tx);

    const beforeRow = await tx.partnerSettings.findUnique({
      where: { id: PARTNER_SETTINGS_ID },
    });

    if (!beforeRow) {
      await tx.partnerSettings.create({ data: { id: PARTNER_SETTINGS_ID } });
    }

    const current = beforeRow ?? (await tx.partnerSettings.findUniqueOrThrow({
      where: { id: PARTNER_SETTINGS_ID },
    }));

    const before = serializeSettingsSnapshot(current);

    const updated = await tx.partnerSettings.update({
      where: { id: PARTNER_SETTINGS_ID },
      data: updates,
    });

    const after = serializeSettingsSnapshot(updated);
    const diff = buildSafeSettingsDiff(
      before as Record<string, unknown>,
      after as Record<string, unknown>
    );

    const changedFields = SETTINGS_FIELD_KEYS.filter(
      (key) => before[key] !== after[key]
    );

    if (!changedFields.length) {
      throw new AdminPartnerSettingsServiceError("Değişiklik algılanmadı.", 400);
    }

    const actions = resolveSettingsAuditActions(
      { isApplicationOpen: before.isApplicationOpen },
      { isApplicationOpen: after.isApplicationOpen }
    );

    for (const action of actions) {
      await logAdminPartnerSettingsAudit({
        userId: actorUserId,
        action,
        displayMessage: `Partner ayarları güncellendi: ${changedFields.join(", ")}`,
        metadata: {
          reason,
          changedFields,
          diff,
        },
        tx,
      });
    }
  });

  invalidateAdminPartnerSettingsCaches();
  return getAdminPartnerSettings();
}
