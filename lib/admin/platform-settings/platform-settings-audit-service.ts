import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PLATFORM_SETTINGS_ID } from "@/lib/admin/platform-settings/platform-settings-defaults";

export type AdminPlatformSettingsAuditInput = {
  userId: string;
  action: string;
  displayMessage: string;
  metadata?: Record<string, unknown>;
  tx?: Pick<typeof db, "activityLog">;
};

export function buildSettingsAuditMetadata(
  settingsId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { settingsId, ...extra };
}

export async function logAdminPlatformSettingsAudit(input: AdminPlatformSettingsAuditInput) {
  const metadata = buildSettingsAuditMetadata(PLATFORM_SETTINGS_ID, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      module: "admin-platform-settings",
      message: input.displayMessage,
      entityType: "PlatformSettings",
      entityId: PLATFORM_SETTINGS_ID,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export function buildStructuredPlatformSettingsActivityWhere(): Prisma.ActivityLogWhereInput {
  return {
    module: "admin-platform-settings",
    OR: [
      {
        AND: [{ entityType: "PlatformSettings" }, { entityId: PLATFORM_SETTINGS_ID }],
      },
      { metadata: { path: ["settingsId"], equals: PLATFORM_SETTINGS_ID } },
    ],
  };
}

export function resolvePlatformSettingsAuditActions(
  before: {
    registrationEnabled: boolean;
    maintenanceMode: boolean;
  },
  after: {
    registrationEnabled: boolean;
    maintenanceMode: boolean;
  }
): string[] {
  const actions: string[] = [];

  const fieldChanged =
    before.registrationEnabled !== after.registrationEnabled ||
    before.maintenanceMode !== after.maintenanceMode;

  if (!fieldChanged) {
    actions.push("PLATFORM_SETTINGS_UPDATED");
    return actions;
  }

  if (before.registrationEnabled !== after.registrationEnabled) {
    actions.push(
      after.registrationEnabled
        ? "PLATFORM_REGISTRATION_ENABLED"
        : "PLATFORM_REGISTRATION_DISABLED"
    );
  }

  if (before.maintenanceMode !== after.maintenanceMode) {
    actions.push(
      after.maintenanceMode
        ? "PLATFORM_MAINTENANCE_ENABLED"
        : "PLATFORM_MAINTENANCE_DISABLED"
    );
  }

  if (
    actions.length === 0 ||
    (actions.length === 1 &&
      !actions.includes("PLATFORM_REGISTRATION_ENABLED") &&
      !actions.includes("PLATFORM_REGISTRATION_DISABLED") &&
      !actions.includes("PLATFORM_MAINTENANCE_ENABLED") &&
      !actions.includes("PLATFORM_MAINTENANCE_DISABLED"))
  ) {
    actions.push("PLATFORM_SETTINGS_UPDATED");
  } else if (!actions.includes("PLATFORM_SETTINGS_UPDATED")) {
    actions.push("PLATFORM_SETTINGS_UPDATED");
  }

  return [...new Set(actions)];
}
