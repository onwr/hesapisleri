import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

export const PARTNER_SETTINGS_ID = "default";

export type AdminPartnerSettingsAuditInput = {
  userId?: string | null;
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

export async function logAdminPartnerSettingsAudit(input: AdminPartnerSettingsAuditInput) {
  const metadata = buildSettingsAuditMetadata(PARTNER_SETTINGS_ID, input.metadata);
  const client = input.tx ?? db;

  return client.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      module: "admin-partner-settings",
      message: input.displayMessage,
      entityType: "PartnerSettings",
      entityId: PARTNER_SETTINGS_ID,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export function buildStructuredPartnerSettingsActivityWhere(): Prisma.ActivityLogWhereInput {
  return {
    module: "admin-partner-settings",
    OR: [
      { AND: [{ entityType: "PartnerSettings" }, { entityId: PARTNER_SETTINGS_ID }] },
      { metadata: { path: ["settingsId"], equals: PARTNER_SETTINGS_ID } },
    ],
  };
}

export function resolveSettingsAuditActions(
  before: { isApplicationOpen: boolean },
  after: { isApplicationOpen: boolean }
): string[] {
  const actions = ["PARTNER_SETTINGS_UPDATED"];
  if (before.isApplicationOpen !== after.isApplicationOpen) {
    actions.push(
      after.isApplicationOpen
        ? "PARTNER_APPLICATIONS_ENABLED"
        : "PARTNER_APPLICATIONS_DISABLED"
    );
  }
  return actions;
}
