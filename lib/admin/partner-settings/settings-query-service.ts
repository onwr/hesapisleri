import "server-only";

import type { PartnerSettings } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPartnerSettingsServiceError } from "@/lib/admin/partner-settings/admin-partner-settings-errors";
import {
  PARTNER_SETTINGS_ID,
  buildStructuredPartnerSettingsActivityWhere,
} from "@/lib/admin/partner-settings/admin-partner-settings-audit-service";
import { redactSettingsAuditValue } from "@/lib/admin/partner-settings/admin-partner-settings-privacy";
import { ensurePartnerSettings } from "@/lib/partner-conversion-service";

export const SETTINGS_FIELD_KEYS = [
  "defaultCommissionRate",
  "cookieDurationDays",
  "minimumPayoutAmount",
  "autoApproveConversions",
  "commissionOnRenewals",
  "isApplicationOpen",
  "termsText",
] as const;

export function serializePartnerSettings(row: PartnerSettings) {
  return {
    id: row.id,
    defaultCommissionRate: Number(row.defaultCommissionRate),
    cookieDurationDays: row.cookieDurationDays,
    minimumPayoutAmount: Number(row.minimumPayoutAmount),
    autoApproveConversions: row.autoApproveConversions,
    commissionOnRenewals: row.commissionOnRenewals,
    isApplicationOpen: row.isApplicationOpen,
    termsText: row.termsText,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeSettingsSnapshot(row: PartnerSettings) {
  return serializePartnerSettings(row);
}

export async function assertPartnerSettingsSingleton() {
  const count = await db.partnerSettings.count();
  if (count > 1) {
    throw new AdminPartnerSettingsServiceError(
      "Birden fazla partner ayar kaydı bulundu; yönetici müdahalesi gerekir.",
      409,
      "SETTINGS_SINGLETON_CONFLICT"
    );
  }
}

export async function loadPartnerSettingsForPayoutEnforcement() {
  await assertPartnerSettingsSingleton();
  const row = await ensurePartnerSettings();
  return { minimumPayoutAmount: Number(row.minimumPayoutAmount) };
}

export async function getAdminPartnerSettings() {
  await assertPartnerSettingsSingleton();
  const row = await ensurePartnerSettings();

  const partnersWithCustomCommission = await db.partnerProfile.count({
    where: {
      commissionRate: { not: row.defaultCommissionRate },
    },
  });

  const partnersWithPayoutMethod = await db.partnerProfile.count({
    where: { payoutMethod: { not: null } },
  });

  return {
    settings: serializePartnerSettings(row),
    overridePriority: {
      commissionRate:
        "PartnerProfile.commissionRate (partner özel) → yeni onaylarda global defaultCommissionRate",
      minimumPayoutAmount: "Yalnız global minimumPayoutAmount (partner override yok)",
      payoutMethod:
        "PartnerProfile.payoutMethod (partner özel); global payout yöntemi/dönem ayarı modelde yok",
      attribution:
        "Global cookieDurationDays; geçmiş conversion/attribution kayıtları değişmez",
    },
    programNotes: {
      applicationToggleField: "isApplicationOpen",
      referralContinues:
        "Referral linkleri ACTIVE partner profilleri için çalışmaya devam eder; başvuru kapatma referral'ı durdurmaz.",
      historicalData:
        "Ayar değişiklikleri yalnız gelecekteki işlemlere uygulanır; geçmiş earning/payout/conversion değişmez.",
    },
    overrideStats: {
      partnersWithCustomCommission,
      partnersWithPayoutMethod,
    },
  };
}

export async function listPartnerSettingsHistory(limit = 20) {
  await assertPartnerSettingsSingleton();

  const rows = await db.activityLog.findMany({
    where: buildStructuredPartnerSettingsActivityWhere(),
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

    return {
      id: row.id,
      action: row.action,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      reason,
      changedFields,
      user: row.user
        ? { id: row.user.id, name: row.user.name, email: row.user.email }
        : null,
      diff: redactSettingsAuditValue("diff", meta.diff),
    };
  });
}
